"""真实 API 级验证后台任务的存活判定。

背景（客户反馈）：桌面版导出可编辑 PPTX 卡在 "88% 构建第 17/24 页"，
重启应用后仍然显示 88%。原因是后台任务只存在于进程内，
数据库里的 PENDING/PROCESSING 记录在进程重启后永远不会再推进，
而状态接口只回读数据库，于是前端一直把僵尸任务当"进行中"。
"""
import time
import uuid
from datetime import datetime, timedelta

from models import Project, Task, db
from services.task_manager import task_manager
from services.task_watchdog import (
    INTERRUPTED_ERROR_CODE,
    STALLED_ERROR_CODE,
    evaluate_task_liveness,
    progress_age_seconds,
    reconcile_orphaned_tasks,
    task_watchdog,
)


def _create_project(app):
    with app.app_context():
        project = Project(
            id=str(uuid.uuid4()),
            creation_type='idea',
            idea_prompt='watchdog test',
            status='DRAFT',
        )
        db.session.add(project)
        db.session.commit()
        return project.id


def _create_export_task(app, project_id, *, status='PROCESSING', percent=88,
                        heartbeat_age_seconds=None, created_age_seconds=None,
                        step='构建第 17/24 页...'):
    with app.app_context():
        task = Task(
            id=str(uuid.uuid4()),
            project_id=project_id,
            task_type='EXPORT_EDITABLE_PPTX',
            status=status,
        )
        if created_age_seconds is not None:
            task.created_at = datetime.utcnow() - timedelta(seconds=created_age_seconds)
        progress = {
            'total': 100,
            'completed': percent,
            'failed': 0,
            'current_step': step,
            'percent': percent,
            'messages': [
                '[构建PPTX] 构建第 16/24 页...',
                f'[构建PPTX] {step}',
            ],
        }
        if heartbeat_age_seconds is not None:
            progress['heartbeat_at'] = (
                datetime.utcnow() - timedelta(seconds=heartbeat_age_seconds)
            ).isoformat()
        task.set_progress(progress)
        db.session.add(task)
        db.session.commit()
        return task.id


def _get_task_status(client, project_id, task_id):
    response = client.get(f'/api/projects/{project_id}/tasks/{task_id}')
    assert response.status_code == 200, response.get_data(as_text=True)
    payload = response.get_json()
    assert payload['success'] is True
    return payload['data']


def test_status_endpoint_fails_task_left_over_from_previous_process(client, app):
    """重启后遗留的 PROCESSING 记录必须变成 FAILED，而不是继续显示 88%。"""
    project_id = _create_project(app)
    task_id = _create_export_task(
        app, project_id, heartbeat_age_seconds=3.5 * 3600,
    )

    data = _get_task_status(client, project_id, task_id)

    assert data['status'] == 'FAILED'
    assert data['progress']['error_code'] == INTERRUPTED_ERROR_CODE
    # 最后一次真实进度要保留下来，方便用户理解卡在哪里
    assert data['progress']['percent'] == 88
    assert data['progress']['current_step'] == '构建第 17/24 页...'
    assert '中断' in data['error_message']
    assert data['progress']['help_text']
    assert data['progress']['error_stage'] == 'task_watchdog'
    assert data['completed_at'] is not None


def test_status_endpoint_keeps_task_with_fresh_heartbeat(client, app):
    """心跳还新鲜时不能误判（覆盖另一进程在跑与创建/注册之间的窗口）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=5)

    data = _get_task_status(client, project_id, task_id)

    assert data['status'] == 'PROCESSING'
    assert data['progress']['percent'] == 88
    assert data['error_message'] is None


def test_status_endpoint_fails_stalled_task_owned_by_this_process(client, app, monkeypatch):
    """本进程内还在"跑"但长时间没有心跳的任务，应被判为卡住。"""
    monkeypatch.setenv('TASK_STALL_TIMEOUT_SECONDS', '1')
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)

    # 模拟本进程持有该任务的 worker
    with task_manager.lock:
        task_manager.active_tasks[task_id] = object()
    task_watchdog.touch(task_id, '构建PPTX')
    try:
        time.sleep(1.2)
        data = _get_task_status(client, project_id, task_id)

        assert data['status'] == 'FAILED'
        assert data['progress']['error_code'] == STALLED_ERROR_CODE
        assert '卡住' in data['error_message']
        assert '构建PPTX' in data['error_message']
    finally:
        with task_manager.lock:
            task_manager.active_tasks.pop(task_id, None)
        task_watchdog.forget(task_id)


def test_status_endpoint_keeps_active_task_with_fresh_heartbeat(client, app, monkeypatch):
    """正在推进的任务（有心跳）不会被误杀。"""
    monkeypatch.setenv('TASK_STALL_TIMEOUT_SECONDS', '1')
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)

    with task_manager.lock:
        task_manager.active_tasks[task_id] = object()
    task_watchdog.touch(task_id, '构建PPTX')
    try:
        data = _get_task_status(client, project_id, task_id)
        assert data['status'] == 'PROCESSING'
    finally:
        with task_manager.lock:
            task_manager.active_tasks.pop(task_id, None)
        task_watchdog.forget(task_id)


def test_reconcile_orphaned_tasks_only_touches_stale_rows(app):
    """启动对账：旧心跳的任务失败，新心跳的任务保持不动。"""
    project_id = _create_project(app)
    stale_id = _create_export_task(app, project_id, heartbeat_age_seconds=7200)
    fresh_id = _create_export_task(app, project_id, heartbeat_age_seconds=3)

    with app.app_context():
        reconciled = reconcile_orphaned_tasks()
        assert reconciled == 1
        stale = Task.query.get(stale_id)
        fresh = Task.query.get(fresh_id)
        assert stale.status == 'FAILED'
        assert stale.get_progress()['error_code'] == INTERRUPTED_ERROR_CODE
        assert fresh.status == 'PROCESSING'


def test_progress_age_seconds_falls_back_to_created_at(app):
    """没有 heartbeat_at 的任务（其他类型）用创建时间兜底。"""
    project_id = _create_project(app)
    task_id = _create_export_task(
        app, project_id, created_age_seconds=600, heartbeat_age_seconds=None,
    )
    with app.app_context():
        age = progress_age_seconds(Task.query.get(task_id))
    assert age is not None
    assert 590 <= age <= 620


def test_watchdog_tracks_and_forgets_heartbeats():
    task_id = f'watchdog-{uuid.uuid4()}'
    assert task_watchdog.seconds_since_touch(task_id) is None

    task_watchdog.touch(task_id, '构建PPTX')
    assert task_watchdog.seconds_since_touch(task_id) is not None
    assert task_watchdog.last_step(task_id) == '构建PPTX'
    assert task_id in task_watchdog.tracked_ids()

    # 不带 step 的心跳应保留上一步
    task_watchdog.touch(task_id)
    assert task_watchdog.last_step(task_id) == '构建PPTX'

    task_watchdog.forget(task_id)
    assert task_watchdog.seconds_since_touch(task_id) is None
    assert task_id not in task_watchdog.tracked_ids()


def test_evaluate_task_liveness_ignores_finished_tasks(app):
    """已完成/已失败的任务不参与对账。"""
    project_id = _create_project(app)
    task_id = _create_export_task(
        app, project_id, status='COMPLETED', heartbeat_age_seconds=7200,
    )
    with app.app_context():
        task = Task.query.get(task_id)
        assert evaluate_task_liveness(task) is False
        assert task.status == 'COMPLETED'
