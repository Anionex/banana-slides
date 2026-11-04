"""HTTP boundary for durable editable exports and explicit checkpoint resume."""
import json
import time
import uuid
from pathlib import Path

from filelock import FileLock, Timeout
from flask import current_app, request
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from models import db, Project, Page, Task, ExportRun
from utils import bad_request, not_found, error_response, success_response, get_filtered_pages
from export_runtime.checkpoints import digest, file_hash
from export_runtime.tasks import ACTIVE, PREFIX, runtime_root, workspace, owner_alive, reconcile


def create_export(project_id):
    app = current_app._get_current_object()
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return bad_request('Expected a JSON object')
    project = db.session.get(Project, project_id)
    if project is None:
        return not_found('Project')
    try:
        field = 'client_task_id'
        task_id = str(uuid.UUID(str(data[field]))) if data.get(field) else str(uuid.uuid4())
        field = 'resume_from_task_id'
        parent_id = str(uuid.UUID(str(data[field]))) if data.get(field) else None
    except (ValueError, TypeError):
        return bad_request(f'{field} must be a valid UUID')
    request_hash = digest({k: v for k, v in data.items() if k != 'client_task_id'})

    def response(task, reused=False):
        return success_response(data={'task_id': task.id, 'reused': reused,
            'method': 'resumable_pipeline', 'export_mode': task.get_progress().get('export_mode', 'full')})

    try:
        with FileLock(str(runtime_root(app) / 'admission.lock')).acquire(timeout=5):
            existing = db.session.get(Task, task_id)
            if existing:
                prior = db.session.get(ExportRun, task_id)
                if (existing.project_id != project_id or existing.task_type != 'EXPORT_EDITABLE_PPTX'
                        or prior is None or prior.request_hash != request_hash):
                    return error_response('EXPORT_TASK_ID_CONFLICT', 'Task ID is already used by a different request', 409)
                return response(existing, True)
            original = None
            if parent_id:
                parent = db.session.get(Task, parent_id)
                prior = db.session.get(ExportRun, parent_id)
                if parent is None or prior is None or parent.project_id != project_id:
                    return not_found('Resumable export')
                reconcile(parent, app)
                successor = ExportRun.query.filter_by(parent_task_id=parent_id).first()
                if successor:
                    return response(db.session.get(Task, successor.task_id), True)
                if parent.status != 'FAILED' or owner_alive(workspace(app, project_id, parent_id)):
                    return error_response('EXPORT_NOT_RESUMABLE', 'Export must be failed and stopped before resuming', 409)
                original = json.loads(prior.request_json)

            for active_task in Task.query.join(ExportRun, ExportRun.task_id == Task.id).filter(Task.status.in_(ACTIVE)).all():
                reconcile(active_task, app)
            active_count = Task.query.join(ExportRun, ExportRun.task_id == Task.id).filter(Task.status.in_(ACTIVE)).count()
            if active_count >= app.config.get('EXPORT_QUEUE_LIMIT', 16):
                return error_response('EXPORT_QUEUE_FULL', 'Export queue is full; retry after a task finishes', 429)

            if original:
                selected_ids = [page['id'] for page in original['pages']]
                options = original['options']
                filename = original['filename']
            else:
                selected_ids = data.get('page_ids')
                if selected_ids is not None and (not isinstance(selected_ids, list) or
                        not selected_ids or any(not isinstance(p, str) for p in selected_ids) or
                        len(set(selected_ids)) != len(selected_ids)):
                    return bad_request('page_ids must be a nonempty list of unique page IDs')
                mode = data.get('export_mode', 'full')
                depth, workers = data.get('max_depth', 1), data.get('max_workers', 4)
                if mode not in ('simple', 'full'):
                    return bad_request("export_mode must be 'full' or 'simple'")
                if type(depth) is not int or not 1 <= depth <= 5:
                    return bad_request('max_depth must be an integer between 1 and 5')
                if type(workers) is not int or not 1 <= workers <= 16:
                    return bad_request('max_workers must be an integer between 1 and 16')
                options = {'export_mode': mode, 'max_depth': 1 if mode == 'simple' else depth,
                           'max_workers': workers, 'allow_partial': bool(project.export_allow_partial),
                           'export_extractor_method': project.export_extractor_method or 'hybrid',
                           'export_inpaint_method': 'generative' if mode == 'simple' else (project.export_inpaint_method or 'hybrid'),
                           'enable_icon_subject_extraction': project.enable_icon_subject_extraction is not False}
                filename = data.get('filename', 'presentation_editable.pptx')
                if not isinstance(filename, str):
                    return bad_request('filename must be a string')
                filename = secure_filename(filename) or 'presentation_editable.pptx'
                if not filename.endswith('.pptx'):
                    filename += '.pptx'

            pages = get_filtered_pages(project_id, selected_ids)
            if not pages or (selected_ids and {p.id for p in pages} != set(selected_ids)):
                return bad_request('One or more selected pages no longer exist')
            # Resume preserves the original ordering, even after project reordering.
            if original:
                by_id = {p.id: p for p in pages}
                pages = [by_id[page_id] for page_id in selected_ids]
            from services.file_service import FileService
            files = FileService(app.config['UPLOAD_FOLDER'])
            inputs = []
            for page in pages:
                if not page.generated_image_path:
                    return bad_request(f'Selected page has no generated image: {page.id}')
                path = Path(files.get_absolute_path(page.generated_image_path))
                if not path.is_file():
                    return bad_request(f'Selected page image is missing: {page.id}')
                inputs.append({'id': page.id, 'path': str(path.resolve()), 'sha256': file_hash(path)})
            task = Task(id=task_id, project_id=project_id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
            task.set_progress({'export_mode': options['export_mode'], 'pipeline_version': 1,
                               'resumable': True, 'page_ids': [p.id for p in pages],
                               'current_step': '等待导出执行额度', 'total': 100, 'completed': 0})
            run = ExportRun(task_id=task_id, project_id=project_id, parent_task_id=parent_id,
                            request_json=json.dumps({'pages': inputs, 'options': options, 'filename': filename}),
                            request_hash=request_hash,
                            artifact_filename=f'{PREFIX}{task_id}-{filename[:160]}',
                            queue_deadline_at=time.time() + app.config.get('EXPORT_QUEUE_TIMEOUT', 900))
            db.session.add_all([task, run])
            db.session.commit()
        # This entry dispatches immediately, outside the shared generation pool.
        from services.task_manager import task_manager, export_editable_pptx_with_recursive_analysis_task
        try:
            task_manager.submit_task(task_id, export_editable_pptx_with_recursive_analysis_task, app=app)
        except Exception as exc:
            from export_runtime.tasks import fail
            from services.export_service import ExportError
            fail(task_id, ExportError('导出任务提交失败', error_type='service',
                 error_code='EXPORT_TASK_SUBMISSION_FAILED', stage='queue_submission',
                 details={'retryable': True, 'technical_message': str(exc)}), 'EXPORT_TASK_SUBMISSION_FAILED')
            return error_response('EXPORT_TASK_SUBMISSION_FAILED', 'Export task could not enter the queue', 503)
        return response(task)
    except Timeout:
        return error_response('EXPORT_QUEUE_BUSY', 'Export submission is busy; retry this request', 503)
    except IntegrityError:
        db.session.rollback()
        return error_response('EXPORT_TASK_ID_CONFLICT', 'Export request already exists', 409)
    except Exception as exc:
        db.session.rollback()
        from services.export_service import ExportService
        return error_response('EXPORT_SUBMISSION_FAILED', ExportService._safe_technical_message(str(exc)), 500)


def list_tasks(project_id):
    if db.session.get(Project, project_id) is None:
        return not_found('Project')
    tasks = Task.query.join(ExportRun, ExportRun.task_id == Task.id).filter(
        Task.project_id == project_id).order_by(Task.created_at.desc()).limit(50).all()
    for task in tasks:
        reconcile(task, current_app._get_current_object())
    return success_response(data={'tasks': [task.to_dict() for task in tasks]})
