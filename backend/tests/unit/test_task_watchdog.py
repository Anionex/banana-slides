"""真实 API 级验证后台任务的存活判定。

背景（客户反馈）：桌面版导出可编辑 PPTX 卡在 "88% 构建第 17/24 页"，
重启应用后仍然显示 88%。原因是后台任务只存在于进程内，
数据库里的 PENDING/PROCESSING 记录在进程重启后永远不会再推进，
而状态接口只回读数据库，于是前端一直把僵尸任务当"进行中"。
"""
import json
import threading
import time
import uuid
from datetime import datetime, timedelta

from sqlalchemy import update

from models import Project, Task, db
from services.task_manager import task_manager
from services.task_watchdog import (
    INTERRUPTED_ERROR_CODE,
    STALLED_ERROR_CODE,
    evaluate_task_liveness,
    get_orphan_grace_seconds,
    mark_task_interrupted,
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
        # 直接写 JSON 模拟"过去某个时刻写入的进度"（set_progress 会打上当前时间的心跳）
        task.progress = json.dumps(progress)
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
        assert '构建 PPTX' in data['error_message']
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


def test_running_task_that_writes_progress_is_never_marked_stalled(client, app, monkeypatch):
    """正在推进的任务不能被误杀（S1 回归）。

    只有导出任务会显式调用 touch_task；其它任务类型（生图、视频导出、模板分析等）
    只写数据库进度。因此"写进度"必须等价于"有心跳"。
    """
    monkeypatch.setenv('TASK_STALL_TIMEOUT_SECONDS', '1')
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)

    stop = threading.Event()

    def worker(tid):
        with app.app_context():
            for index in range(40):
                if stop.is_set():
                    return
                task = Task.query.get(tid)
                if task is None:
                    return
                task.set_progress({
                    'total': 100,
                    'completed': index,
                    'failed': 0,
                    'percent': index,
                    'current_step': f'第 {index} 步',
                })
                db.session.commit()
                time.sleep(0.15)

    task_manager.submit_task(task_id, worker)
    try:
        time.sleep(2.2)  # 远超 1s 的 stall 阈值，但 worker 一直在写进度
        data = _get_task_status(client, project_id, task_id)
        assert data['status'] == 'PROCESSING', data
        assert data['progress']['percent'] > 0
    finally:
        stop.set()
        with task_manager.lock:
            task_manager.active_tasks.pop(task_id, None)
        task_watchdog.forget(task_id)
        time.sleep(0.2)


def test_interrupted_task_uses_last_progress_write_not_created_at(client, app):
    """中断判定必须基于最后一次写进度的时间，而不是创建时间。"""
    project_id = _create_project(app)
    task_id = _create_export_task(
        app,
        project_id,
        created_age_seconds=7200,      # 两小时前创建
        heartbeat_age_seconds=1200,    # 但 20 分钟前还在写进度
    )

    data = _get_task_status(client, project_id, task_id)

    assert data['status'] == 'FAILED'
    idle = data['progress']['error_details']['idle_seconds']
    assert 1100 <= idle <= 1300, idle


def test_orphan_grace_zero_falls_back_to_default(monkeypatch):
    monkeypatch.setenv('TASK_ORPHAN_GRACE_SECONDS', '0')
    assert get_orphan_grace_seconds() > 0


def test_stall_clock_starts_when_task_actually_begins(app):
    """排队等待不算卡住：worker 真正开始时重新打心跳（Codex P2）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)
    observed = {}

    def worker(tid):
        observed['step'] = task_watchdog.last_step(tid)
        observed['idle'] = task_watchdog.seconds_since_touch(tid)

    task_manager.submit_task(task_id, worker)
    try:
        deadline = time.time() + 5
        while 'step' not in observed and time.time() < deadline:
            time.sleep(0.05)
        assert observed.get('step') == '开始执行'
        assert observed.get('idle') is not None and observed['idle'] < 1
    finally:
        with task_manager.lock:
            task_manager.active_tasks.pop(task_id, None)
        task_watchdog.forget(task_id)


def test_task_insert_does_not_start_the_stall_clock(app):
    """创建任务行本身不算"有进度"，否则排队时长会计入卡住判定（Codex P2）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)
    assert task_watchdog.seconds_since_touch(task_id) is None


def test_stale_read_does_not_overwrite_a_finished_task(app):
    """请求拿到过期快照时不能把已经完成的任务改写成失败（Codex P2）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=7200)

    with app.app_context():
        # 模拟"请求已读到 PROCESSING 快照，之后 worker 提交了完成"
        stale_progress = Task.query.get(task_id).get_progress()
        db.session.execute(
            update(Task).where(Task.id == task_id).values(status='COMPLETED')
        )
        db.session.commit()

        class _StaleTask:
            id = task_id
            status = 'PROCESSING'
            created_at = datetime.utcnow() - timedelta(hours=2)

            def get_progress(self):
                return stale_progress

        assert mark_task_interrupted(_StaleTask()) is False
        assert Task.query.get(task_id).status == 'COMPLETED'


def test_watchdog_message_follows_interface_language(client, app):
    """非导出任务直接展示 error_message，因此要跟随界面语言（Accept-Language）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=7200)

    response = client.get(
        f'/api/projects/{project_id}/tasks/{task_id}',
        headers={'Accept-Language': 'en-US,en;q=0.9'},
    )
    data = response.get_json()['data']

    assert data['status'] == 'FAILED'
    assert data['error_message'].startswith('Task interrupted')
    assert data['progress']['help_text'].startswith('Remove the entry')
    assert data['progress']['error_code'] == INTERRUPTED_ERROR_CODE


def test_watchdog_message_falls_back_to_output_language(client, app, monkeypatch):
    """没有 Accept-Language 时回退到应用配置的输出语言。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=7200)

    monkeypatch.setitem(app.config, 'OUTPUT_LANGUAGE', 'en')
    data = _get_task_status(client, project_id, task_id)

    assert data['error_message'].startswith('Task interrupted')


def test_startup_reconciled_message_is_localized_at_display_time(client, app):
    """启动对账发生在无请求上下文时（只能按 OUTPUT_LANGUAGE 写），
    展示时要按界面语言重算（Codex P2）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, status='FAILED', heartbeat_age_seconds=7200)

    with app.app_context():
        task = Task.query.get(task_id)
        task.error_message = '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。'
        task.progress = json.dumps({
            'percent': 88,
            'error_code': INTERRUPTED_ERROR_CODE,
            'error_stage': 'task_watchdog',
            'error_details': {'reason': 'interrupted', 'idle_seconds': 10800},
            'watchdog_message_text': '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。',
            'help_text': '点任务右侧的 × 移除这条记录，然后重新发起即可。',
        })
        db.session.commit()

    response = client.get(
        f'/api/projects/{project_id}/tasks/{task_id}',
        headers={'Accept-Language': 'en'},
    )
    data = response.get_json()['data']
    assert data['error_message'].startswith('Task interrupted')
    assert '3.0 hours' in data['error_message']
    assert data['progress']['help_text'].startswith('Remove the entry')


def test_worker_error_is_not_overwritten_by_localization(client, app):
    """看门狗判失败后 worker 写了更具体的错误，展示时不能被通用文案顶掉（复核 M2）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, status='FAILED', heartbeat_age_seconds=7200)

    with app.app_context():
        task = Task.query.get(task_id)
        task.error_message = 'AI 服务返回 401 invalid api key'
        task.progress = json.dumps({
            'percent': 40,
            'error_code': STALLED_ERROR_CODE,
            'error_stage': 'task_watchdog',
            'error_details': {'reason': 'stalled', 'idle_seconds': 1900, 'last_step': '构建PPTX'},
            'watchdog_message_text': '任务疑似卡住：已 32 分钟没有进度更新（最后一步：构建 PPTX）。',
        })
        db.session.commit()

    response = client.get(
        f'/api/projects/{project_id}/tasks/{task_id}',
        headers={'Accept-Language': 'en'},
    )
    data = response.get_json()['data']
    assert data['error_message'] == 'AI 服务返回 401 invalid api key'


def test_stalled_message_is_localized_at_display_time(client, app):
    """STALLED 的展示路径也要按界面语言重算（复核：此前无覆盖）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, status='FAILED', heartbeat_age_seconds=7200)
    chinese_message = '任务疑似卡住：已 32 分钟没有进度更新（最后一步：构建 PPTX）。'

    with app.app_context():
        task = Task.query.get(task_id)
        task.error_message = chinese_message
        task.progress = json.dumps({
            'percent': 88,
            'error_code': STALLED_ERROR_CODE,
            'error_stage': 'task_watchdog',
            'error_details': {'reason': 'stalled', 'idle_seconds': 1900, 'last_step': '构建PPTX'},
            'watchdog_message_text': chinese_message,
            'help_text': '可以点右侧的 × 移除该任务后重新导出。',
        })
        db.session.commit()

    response = client.get(
        f'/api/projects/{project_id}/tasks/{task_id}',
        headers={'Accept-Language': 'en'},
    )
    data = response.get_json()['data']
    assert data['error_message'].startswith('Task looks stuck')
    assert 'building the PPTX' in data['error_message']
    assert data['error_message'].endswith('.')
    assert '。' not in data['error_message']
    assert data['progress']['help_text'].startswith('Remove the task')


def test_settings_test_status_localizes_watchdog_failure(client, app):
    """设置页测试任务的状态接口同样要本地化看门狗文案（复核：此前无覆盖）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, status='FAILED', heartbeat_age_seconds=7200)

    with app.app_context():
        task = Task.query.get(task_id)
        task.task_type = 'TEST_TEXT_MODEL'
        task.error_message = '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。'
        task.progress = json.dumps({
            'percent': 0,
            'error_code': INTERRUPTED_ERROR_CODE,
            'error_stage': 'task_watchdog',
            'error_details': {'reason': 'interrupted', 'idle_seconds': 10800},
            'watchdog_message_text': '任务被中断：后台服务已重启或进程已退出，该任务不会继续执行。',
        })
        db.session.commit()

    response = client.get(
        f'/api/settings/tests/{task_id}/status',
        headers={'Accept-Language': 'en'},
    )
    payload = response.get_json()['data']
    assert payload['error'].startswith('Task interrupted')
    assert payload['help_text'].startswith('Remove the entry')


def test_task_scope_restores_previous_binding():
    """task_scope 必须保存/恢复线程绑定（复核：此前无覆盖）。"""
    from services.task_watchdog import task_scope

    task_watchdog.forget('outer-task')
    task_watchdog.forget('inner-task')
    task_watchdog.bind_thread('outer-task')
    try:
        assert task_watchdog.thread_task() == 'outer-task'
        with task_scope('inner-task'):
            assert task_watchdog.thread_task() == 'inner-task'
        assert task_watchdog.thread_task() == 'outer-task'

        # 异常路径同样要恢复
        try:
            with task_scope('inner-task'):
                raise RuntimeError('boom')
        except RuntimeError:
            pass
        assert task_watchdog.thread_task() == 'outer-task'
    finally:
        task_watchdog.unbind_thread()
        task_watchdog.forget('outer-task')
        task_watchdog.forget('inner-task')
    assert task_watchdog.thread_task() is None


def test_runner_binds_and_unbinds_the_worker_thread(app):
    """真实 submit_task 路径里 worker 线程必须绑定到任务（复核：此前无覆盖）。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)
    observed = {}

    def worker(tid):
        observed['bound'] = task_watchdog.thread_task()

    task_manager.submit_task(task_id, worker)
    try:
        deadline = time.time() + 5
        while 'bound' not in observed and time.time() < deadline:
            time.sleep(0.05)
        assert observed.get('bound') == task_id
        # worker 结束后解绑（等 done callback 跑完）
        deadline = time.time() + 5
        while task_watchdog.thread_task() == task_id and time.time() < deadline:
            time.sleep(0.05)
        assert task_watchdog.thread_task() != task_id
    finally:
        with task_manager.lock:
            task_manager.active_tasks.pop(task_id, None)
        task_watchdog.forget(task_id)


def test_every_limiter_wait_is_wrapped_in_task_scope():
    """结构性回归：限流等待必须绑定任务，否则嵌套线程等槽时会被判卡住。"""
    from pathlib import Path

    source = Path(__file__).resolve().parents[2] / 'services' / 'task_manager.py'
    limiter_lines = [
        line for line in source.read_text(encoding='utf-8').splitlines()
        if 'resource_limiter.slot(' in line
    ]
    assert limiter_lines, 'expected limiter usages in task_manager.py'
    missing = [line.strip() for line in limiter_lines if 'task_scope(task_id)' not in line]
    assert not missing, f'limiter waits without task_scope: {missing}'


def test_port_available_detects_occupied_port():
    """端口被占用时跳过对账，避免第二个实例误判另一实例的任务（Codex P2）。"""
    import socket

    from app import _port_available

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(('0.0.0.0', 0))
    listener.listen(1)
    try:
        occupied = listener.getsockname()[1]
        assert _port_available(occupied) is False
    finally:
        listener.close()


def test_port_available_ignores_time_wait():
    """只剩 TIME_WAIT 的端口要视为可用，否则刚重启时会跳过对账（复核 S1）。"""
    import socket

    from app import _port_available

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', 0))
    server.listen(1)
    port = server.getsockname()[1]

    client = socket.create_connection(('127.0.0.1', port))
    conn, _ = server.accept()
    conn.close()          # 服务端先关闭 → 服务端进入 TIME_WAIT
    client.close()
    server.close()

    assert _port_available(port) is True


def test_instance_lock_blocks_a_second_process(app):
    """第二个实例拿不到数据根锁，因此不会执行启动对账（复核 M1）。"""
    import os
    import subprocess
    import sys
    import textwrap

    from app import _acquire_instance_lock

    lock_path = os.path.join(app.config['UPLOAD_FOLDER'], '.backend-instance.lock')
    script = textwrap.dedent(
        f"""
        import fcntl, time
        handle = open(r"{lock_path}", 'a+')
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        print('locked', flush=True)
        time.sleep(10)
        """
    )
    holder = subprocess.Popen(
        [sys.executable, '-c', script], stdout=subprocess.PIPE, text=True
    )
    try:
        assert holder.stdout.readline().strip() == 'locked'
        assert _acquire_instance_lock(app) is False
    finally:
        holder.kill()
        holder.wait(timeout=5)


def test_limiter_wait_keeps_the_heartbeat_alive(app):
    """worker 等待限流槽时仍然算"活着"，不能被判卡住（Codex P2）。"""
    from services.task_manager import ResourceLimiter
    from services.task_watchdog import task_scope

    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, heartbeat_age_seconds=0)
    limiter = ResourceLimiter('test-limiter', 1)
    seen = {}

    def worker(tid):
        # 与真实路径一致：worker 线程内部用 task_scope 绑定自己
        with task_scope(tid):
            task_watchdog.touch(tid, '等待限流槽')
            with limiter.slot('blocked'):
                seen['idle_after_wait'] = task_watchdog.seconds_since_touch(tid)

    holder_ready = threading.Event()

    def holder():
        with limiter.slot('holder'):
            holder_ready.set()
            time.sleep(2.0)

    holder_thread = threading.Thread(target=holder)
    holder_thread.start()
    assert holder_ready.wait(timeout=3)

    worker_thread = threading.Thread(target=worker, args=(task_id,))
    worker_thread.start()
    worker_thread.join(timeout=5)
    holder_thread.join(timeout=3)
    task_watchdog.forget(task_id)

    assert 'idle_after_wait' in seen
    # 等待期间心跳被持续刷新（而不是停留在约 2 秒前的初值）
    assert seen['idle_after_wait'] < 1.0, seen


def test_watchdog_failure_stays_terminal_when_export_finishes(app, db_session, tmp_path, monkeypatch):
    """看门狗判失败后 worker 又跑完：保持 FAILED，但保留产物信息（Codex P2）。"""
    from PIL import Image
    from models import Page
    from services.export_service import ExportService
    from services.task_manager import export_editable_pptx_with_recursive_analysis_task

    image_path = tmp_path / 'page.png'
    Image.new('RGB', (320, 180), 'white').save(image_path)

    project = Project(creation_type='idea', idea_prompt='demo')
    db.session.add(project)
    db.session.flush()
    db.session.add(Page(project_id=project.id, order_index=0, generated_image_path='pages/page.png'))
    task = Task(
        project_id=project.id,
        task_type='EXPORT_EDITABLE_PPTX',
        status='FAILED',
        error_message='任务疑似卡住：已30 分钟没有进度更新。',
    )
    task.progress = json.dumps({
        'percent': 88,
        'error_code': STALLED_ERROR_CODE,
        'error_stage': 'task_watchdog',
        'current_step': '构建第 17/24 页...',
    })
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    class FileServiceStub:
        def get_absolute_path(self, _relative_path):
            return str(image_path)

    monkeypatch.setattr(
        'services.image_editability.TextAttributeExtractorFactory.create_caption_model_extractor',
        lambda: None,
    )

    def fake_export(*_args, progress_callback=None, heartbeat_callback=None, **_kwargs):
        progress_callback('构建PPTX', '构建第 24/24 页...', 94)
        return b'pptx-bytes', None

    monkeypatch.setattr(
        ExportService,
        'create_editable_pptx_with_recursive_analysis',
        staticmethod(fake_export),
    )

    export_editable_pptx_with_recursive_analysis_task(
        task_id=task_id,
        project_id=project.id,
        filename='demo.pptx',
        file_service=FileServiceStub(),
        app=app,
    )

    db.session.expire_all()
    stored = Task.query.get(task_id)
    assert stored.status == 'FAILED'
    progress = stored.get_progress()
    assert progress['error_code'] == STALLED_ERROR_CODE
    assert progress['download_url'].endswith('demo.pptx')
    assert progress['filename'] == 'demo.pptx'


def test_watchdog_failure_is_terminal_for_every_task_type(app, db_session):
    """任何任务类型（不只是导出）在看门狗判失败后都不能被改回成功。"""
    project_id = _create_project(app)
    with app.app_context():
        task = Task(
            id=str(uuid.uuid4()),
            project_id=project_id,
            task_type='GENERATE_IMAGES',
            status='FAILED',
            error_message='任务疑似卡住：已30 分钟没有进度更新。',
        )
        task.progress = json.dumps({
            'percent': 40,
            'error_code': STALLED_ERROR_CODE,
            'error_stage': 'task_watchdog',
        })
        db.session.add(task)
        db.session.commit()

        # worker 之后恢复并尝试标记完成
        task.status = 'COMPLETED'
        task.set_progress({'total': 10, 'completed': 10, 'percent': 100, 'current_step': '完成'})
        db.session.commit()

        stored = Task.query.get(task.id)
        assert stored.status == 'FAILED'
        assert stored.get_progress()['error_code'] == STALLED_ERROR_CODE


def test_set_progress_stamps_heartbeat_and_preserves_failure_reason(app):
    """任何任务写进度都会刷新 heartbeat_at；失败原因不会被后续进度覆盖。"""
    project_id = _create_project(app)
    task_id = _create_export_task(app, project_id, status='FAILED', heartbeat_age_seconds=60)

    with app.app_context():
        task = Task.query.get(task_id)
        task.set_progress({
            'total': 100,
            'completed': 88,
            'percent': 88,
            'error_code': 'TASK_INTERRUPTED',
            'error_stage': 'task_watchdog',
            'error_details': {'reason': 'interrupted', 'idle_seconds': 60},
            'help_text': 'help',
        })
        db.session.commit()

        # 失败后 worker 又写了一次进度（没有带失败字段）
        task.set_progress({'total': 100, 'completed': 90, 'percent': 90})
        db.session.commit()

        progress = task.get_progress()
        assert progress['error_code'] == 'TASK_INTERRUPTED'
        assert progress['error_stage'] == 'task_watchdog'
        assert progress['help_text'] == 'help'
        assert progress['error_details']['idle_seconds'] == 60
        assert progress['heartbeat_at']
        age = progress_age_seconds(task)
        assert age is not None and age < 5

        # 空进度写入（设置页测试失败路径会这么写）也不能抹掉看门狗诊断
        task.set_progress({})
        db.session.commit()
        progress = task.get_progress()
        assert progress['error_code'] == 'TASK_INTERRUPTED'
        assert progress['error_stage'] == 'task_watchdog'
        assert progress['help_text'] == 'help'
