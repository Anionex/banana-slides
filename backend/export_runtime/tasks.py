"""Supervisor ownership, fenced DB writes and publication for editable exports."""
from datetime import datetime
import json
import os
from pathlib import Path
import time
import zipfile

from filelock import FileLock, Timeout

from .checkpoints import file_hash, sync_file
from .control import ExportAborted, ExportDeadline, DEFAULT_LIMITS

ACTIVE = ('PENDING', 'RUNNING', 'PROCESSING')
PREFIX = 'editable-run-'


def runtime_root(app):
    path = Path(app.config['UPLOAD_FOLDER']).resolve() / '.export-runtime'
    path.mkdir(parents=True, exist_ok=True)
    return path


def workspace(app, project_id, task_id):
    return Path(app.config['UPLOAD_FOLDER']).resolve() / project_id / '.editable-exports' / task_id


def owner_alive(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    for name in ('owner.lock', 'supervisor.lock'):
        lock = FileLock(str(root / name))
        try:
            lock.acquire(timeout=0)
        except Timeout:
            return True
        else:
            lock.release()
    return False


def update_active(task_id, *, status=None, error=None, patch=None):
    """Terminal state is fenced in SQL, not via a stale ORM instance."""
    from sqlalchemy import update
    from models import db, Task
    db.session.expire_all()
    task = db.session.get(Task, task_id)
    if task is None or task.status not in ACTIVE:
        return False
    payload = {**task.get_progress(), **(patch or {}), 'heartbeat_at': datetime.utcnow().isoformat()}
    values = {'progress': json.dumps(payload, ensure_ascii=False)}
    if status:
        values['status'] = status
    if error:
        values['error_message'] = error
    if status in ('FAILED', 'COMPLETED'):
        values['completed_at'] = datetime.utcnow()
    result = db.session.execute(update(Task).where(Task.id == task_id, Task.status.in_(ACTIVE)).values(**values))
    db.session.commit()
    return result.rowcount == 1


def fail(task_id, error, code=None):
    from services.export_service import ExportService
    safe_message = ExportService._safe_technical_message(str(error))
    detail = error.to_dict() if hasattr(error, 'to_dict') else getattr(error, 'details', {})
    def sanitize(value):
        if isinstance(value, str):
            return ExportService._safe_technical_message(value)
        if isinstance(value, dict):
            return {key: sanitize(item) for key, item in value.items()}
        if isinstance(value, list):
            return [sanitize(item) for item in value]
        return value
    detail = sanitize(detail)
    classified = ExportService._build_unexpected_export_error(safe_message, 'export_pipeline').to_dict()
    classified.update(detail)
    if code in ('EXPORT_INTERRUPTED', 'EXPORT_DEADLINE'):
        classified.update(message=safe_message, help_text='')
    return update_active(task_id, status='FAILED', error=classified.get('message') or safe_message, patch={
        'failed': 1, 'backend_status': 'FAILED', 'error_code': code or classified.get('error_code') or 'EXPORT_PIPELINE_FAILED',
        'error_stage': classified.get('stage', 'export_pipeline'), 'current_step': safe_message,
        'error_type': classified.get('error_type', 'internal'),
        'error_details': classified.get('details', {}),
        'resumable': True, 'download_url': None,
        'help_text': (classified.get('help_text') or '') + ' 可从已保存的断点继续；已完成并校验通过的步骤会复用。',
    })


def reconcile(task, app):
    """Return whether this is a pipeline task; do not use process-local watchdog."""
    from models import db, ExportRun
    run = db.session.get(ExportRun, task.id)
    if run is None:
        return False
    root = workspace(app, task.project_id, task.id)
    if task.status in ACTIVE and not owner_alive(root):
        age = (datetime.utcnow() - task.created_at).total_seconds()
        if age > 5:
            fail(task.id, '导出执行进程已中断，可以从断点继续', 'EXPORT_INTERRUPTED')
            db.session.refresh(task)
    if task.status == 'FAILED' and not owner_alive(root):
        (Path(app.config['UPLOAD_FOLDER']) / task.project_id / 'exports' / run.artifact_filename).unlink(missing_ok=True)
    return True


def artifact_allowed(project_id, filename, *, verify=False):
    if not filename.startswith(PREFIX):
        return True
    from flask import current_app
    from models import db, ExportRun, Task
    run = ExportRun.query.filter_by(project_id=project_id, artifact_filename=filename).first()
    if run is None or not run.artifact_sha256:
        return False
    task = db.session.get(Task, run.task_id)
    if task is None or task.status != 'COMPLETED':
        return False
    if verify:
        path = Path(current_app.config['UPLOAD_FOLDER']) / project_id / 'exports' / filename
        return path.is_file() and file_hash(path) == run.artifact_sha256
    return True


def publish(app, run, result, page_count):
    from sqlalchemy import update
    from models import db, Task
    root = workspace(app, run.project_id, run.task_id)
    source = root / 'result.pptx'
    if Path(result['path']).resolve() != source.resolve():
        raise ValueError('Invalid worker artifact path')
    if result['pages'] != page_count or file_hash(source) != result['sha256']:
        raise ValueError('Export artifact does not match its manifest')
    with zipfile.ZipFile(source) as deck:
        if deck.testzip() is not None:
            raise ValueError('Invalid PPTX archive')
        slides = [p for p in deck.namelist() if p.startswith('ppt/slides/slide') and p.endswith('.xml')]
        if len(slides) != page_count:
            raise ValueError('Export slide count does not match the selected pages')
    sync_file(source)
    destination = Path(app.config['UPLOAD_FOLDER']) / run.project_id / 'exports' / run.artifact_filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    db.session.expire_all()
    task = db.session.get(Task, run.task_id)
    payload = {**task.get_progress(), 'total': 100, 'completed': 100, 'percent': 100,
               'failed': 0, 'current_step': '导出完成', 'resumable': False,
               'download_url': f'/files/{run.project_id}/exports/{run.artifact_filename}',
               'filename': run.artifact_filename, 'warnings': result['warnings'],
               'warning_details': result['warning_details'], 'reused_nodes': result['reused_nodes']}
    try:
        changed = db.session.execute(update(Task).where(Task.id == run.task_id, Task.status.in_(ACTIVE)).values(
            status='COMPLETED', progress=json.dumps(payload, ensure_ascii=False), completed_at=datetime.utcnow()))
        if changed.rowcount != 1:
            db.session.rollback()
            raise ExportAborted('任务已终止，未发布产物')
        run.artifact_sha256 = result['sha256']
        os.replace(source, destination)
        if os.name != 'nt':
            directory = os.open(destination.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        db.session.commit()
    except BaseException:
        db.session.rollback()
        destination.unlink(missing_ok=True)
        raise


def run_task(task_id, app):
    from models import db, ExportRun
    with app.app_context():
        run = db.session.get(ExportRun, task_id)
        if run is None:
            fail(task_id, 'Missing durable export request')
            return
        root = workspace(app, run.project_id, task_id)
        root.mkdir(parents=True, exist_ok=True)
        # Ownership spans process launch, exit, validation and publication.
        # Actual provider/export capacity is still held only by the child.
        try:
            with FileLock(str(root / 'supervisor.lock')).acquire(timeout=0):
                _run_owned_task(task_id, app)
        except Timeout:
            return  # another supervisor already owns this exact task


def _run_owned_task(task_id, app):
    from models import db, Task, ExportRun
    from .process import supervise
    with app.app_context():
        try:
            run = db.session.get(ExportRun, task_id)
            if run is None:
                raise ValueError('Missing durable export request')
            request = json.loads(run.request_json)
            ancestors = []
            parent_id = run.parent_task_id
            while parent_id:
                parent = db.session.get(ExportRun, parent_id)
                if parent is None or parent.project_id != run.project_id:
                    raise ValueError('Invalid checkpoint lineage')
                parent_root = workspace(app, run.project_id, parent_id)
                if owner_alive(parent_root):
                    raise ExportAborted('上次导出仍在退出，请稍后继续')
                ancestors.append(str(parent_root))
                parent_id = parent.parent_task_id
            # Only JSON config travels over the pipe; no key is written to workspace.
            config = {key: value for key, value in app.config.items()
                      if isinstance(value, (str, int, float, bool, type(None), list, dict))}
            if any(str(config.get(key, '')).lower() == 'codex' for key in
                   ('AI_PROVIDER_FORMAT', 'IMAGE_MODEL_SOURCE', 'IMAGE_CAPTION_MODEL_SOURCE')):
                from services.ai_providers import _get_openai_oauth_token
                config['EXPORT_OAUTH_TOKEN'] = _get_openai_oauth_token()
            payload = {**request, 'workspace': str(workspace(app, run.project_id, task_id)),
                       'runtime_dir': str(runtime_root(app)), 'config': config,
                       'ancestors': ancestors, 'queue_deadline_at': run.queue_deadline_at,
                       'run_timeout': app.config.get('EXPORT_RUN_TIMEOUT', 3600),
                       'node_timeout': app.config.get('EXPORT_NODE_TIMEOUT', 600),
                       'limits': {name: app.config.get('EXPORT_LIMIT_' + name.upper(), default)
                                  for name, default in DEFAULT_LIMITS.items()}}
            last_write = [0.0]
            pending = {'total': 100, 'completed': 0, 'percent': 0, 'failed': 0,
                       'current_step': '等待导出执行额度', 'resumable': True,
                       'export_mode': request['options']['export_mode'],
                       'page_ids': [p['id'] for p in request['pages']]}

            def active():
                db.session.expire_all()
                task = db.session.get(Task, task_id)
                return task is not None and task.status in ACTIVE

            def event(item):
                kind = item['event']
                if kind == 'running':
                    update_active(task_id, status='RUNNING', patch={'current_step': '准备导出'})
                elif kind == 'progress':
                    pending['percent'] = max(pending['percent'], min(99, item['percent']))
                    pending['completed'] = pending['percent']
                    pending['current_step'] = item['label']
                    pending['messages'] = [item['label']]
                elif kind == 'checkpoint':
                    pending['reused_nodes'] = item['reused']
                elif kind in ('waiting', 'retry'):
                    pending['activity'] = item
                elif kind == 'node_started':
                    pending['current_step'] = {
                        'extract': '识别页面元素', 'candidate': '生成无字背景', 'review': '校验去字结果',
                        'target_review': '区分文字与图标',
                        'analysis': '分析页面', 'page_analysis': '分析页面', 'global_style': '识别整页文字样式',
                        'local_style': '识别文字颜色', 'ocr': '识别文字', 'caption': '识别文字与校验',
                        'image': '生成背景', 'image_submission': '生成背景',
                        'mineru_submission': '提交版面识别', 'mineru_upload': '上传页面',
                    }.get(item['label'], item['label'])
                if time.monotonic() - last_write[0] >= .25 or kind == 'checkpoint':
                    update_active(task_id, patch=pending)
                    last_write[0] = time.monotonic()

            update_active(task_id, patch=pending)
            result = supervise(payload, on_event=event, is_active=active)
            publish(app, run, result, len(request['pages']))
        except BaseException as exc:
            db.session.rollback()
            fail(task_id, exc, 'EXPORT_DEADLINE' if isinstance(exc, ExportDeadline) else None)
