"""Template Asset Controller — per-page template feature (PRD 2026-06-22).

Endpoints under `/api/projects/<project_id>/template-assets` plus the page-
level template patch + project-level mode switch.

The pre-existing `template_bp` (project-level single-template upload) is left
untouched as the legacy compatibility layer for decision 7.
"""
import logging
import uuid
from datetime import datetime

from flask import Blueprint, current_app, request
from sqlalchemy.orm import joinedload

from models import db, Project, ProjectTemplateAsset, Page, Task
from services import FileService
from utils import (
    allowed_file,
    bad_request,
    error_response,
    not_found,
    success_response,
)


logger = logging.getLogger(__name__)


template_assets_bp = Blueprint(
    'template_assets', __name__, url_prefix='/api/projects'
)
page_template_bp = Blueprint(
    'page_template', __name__, url_prefix='/api/projects'
)
template_mode_bp = Blueprint(
    'template_mode', __name__, url_prefix='/api/projects'
)


# Task type names — kept in module-level constants so the controller, the
# task functions in `task_manager`, and tests share a single source of truth.
TASK_SPLIT_TEMPLATE_PDF = 'SPLIT_TEMPLATE_PDF'
TASK_ANALYZE_TEMPLATE = 'ANALYZE_TEMPLATE'
TASK_AUTO_MATCH_TEMPLATES = 'AUTO_MATCH_TEMPLATES'

VALID_SELECTION_SOURCES = {'manual', 'auto', 'batch_apply'}


# ---------- helpers ----------


def _project_or_404(project_id: str):
    project = Project.query.get(project_id)
    if not project:
        return None, not_found('Project')
    return project, None


def _asset_or_404(project_id: str, asset_id: str):
    asset = ProjectTemplateAsset.query.filter_by(
        id=asset_id, project_id=project_id
    ).first()
    if not asset:
        return None, not_found('TemplateAsset')
    return asset, None


def _enqueue_analyze_template(project_id: str, asset_id: str) -> str:
    """Create a task row + submit the analyze background task.

    Returns the new task_id.
    """
    # Lazy import to avoid circular imports between controllers and task_manager
    from services.task_manager import task_manager, analyze_template_task
    from services.ai_service import AIService

    task = Task(
        project_id=project_id,
        task_type=TASK_ANALYZE_TEMPLATE,
        status='PENDING',
    )
    task.set_progress({'asset_id': asset_id, 'stage': 'queued'})
    db.session.add(task)
    db.session.commit()

    ai_service = AIService()
    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    app = current_app._get_current_object()
    task_manager.submit_task(
        task.id,
        analyze_template_task,
        project_id,
        asset_id,
        ai_service,
        file_service,
        app,
    )
    return task.id


# ---------- 3.2 Asset CRUD ----------


@template_assets_bp.route('/<project_id>/template-assets', methods=['GET'])
def list_template_assets(project_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err
    assets = (
        ProjectTemplateAsset.query
        .filter_by(project_id=project_id)
        .order_by(ProjectTemplateAsset.sort_order.asc(),
                  ProjectTemplateAsset.created_at.asc())
        .options(joinedload(ProjectTemplateAsset.pages_referenced))
        .all()
    )
    return success_response({
        'assets': [a.to_dict(include_referenced_pages=True) for a in assets]
    })


@template_assets_bp.route('/<project_id>/template-assets', methods=['POST'])
def upload_template_asset(project_id: str):
    """Upload a single template image.

    Form: image=@file.png, user_label=...(optional)
    Query: bind_to_page=<page_id>(optional, PRD §10.3)
    """
    project, err = _project_or_404(project_id)
    if err:
        return err

    if 'image' not in request.files:
        return bad_request("Field 'image' is required")
    file = request.files['image']
    if not file.filename:
        return bad_request('No file selected')
    if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
        return bad_request('Invalid file type. Allowed: png, jpg, jpeg, gif, webp')

    user_label = (request.form.get('user_label') or '').strip() or None
    bind_to_page = request.args.get('bind_to_page')
    if bind_to_page:
        page = Page.query.filter_by(id=bind_to_page, project_id=project_id).first()
        if not page:
            return bad_request("bind_to_page does not belong to this project")

    asset_id = str(uuid.uuid4())
    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    try:
        image_path, thumb_path = file_service.save_template_asset(
            file, project_id, asset_id
        )
    except ValueError as exc:
        return bad_request(str(exc))

    sort_order = (
        db.session.query(db.func.coalesce(db.func.max(ProjectTemplateAsset.sort_order), -1))
        .filter(ProjectTemplateAsset.project_id == project_id)
        .scalar()
    ) + 1
    asset = ProjectTemplateAsset(
        id=asset_id,
        project_id=project_id,
        image_path=image_path,
        thumb_path=thumb_path,
        source='upload',
        analysis_status='pending',
        user_label=user_label,
        sort_order=sort_order,
    )
    db.session.add(asset)

    if bind_to_page:
        page.template_asset_id = asset_id
        page.template_selection_source = 'manual'

    db.session.commit()

    analyze_task_id = _enqueue_analyze_template(project_id, asset_id)

    return success_response({
        'asset': asset.to_dict(include_referenced_pages=True),
        'analyze_task_id': analyze_task_id,
    }, status_code=201)


@template_assets_bp.route(
    '/<project_id>/template-assets/upload-pdf', methods=['POST']
)
def upload_template_pdf(project_id: str):
    """Upload a PDF and asynchronously split it into per-page assets."""
    project, err = _project_or_404(project_id)
    if err:
        return err

    if 'pdf' not in request.files:
        return bad_request("Field 'pdf' is required")
    file = request.files['pdf']
    if not file.filename:
        return bad_request('No file selected')

    task = Task(
        project_id=project_id,
        task_type=TASK_SPLIT_TEMPLATE_PDF,
        status='PENDING',
    )
    task.set_progress({'total': 0, 'completed': 0, 'failed': 0,
                       'created_asset_ids': []})
    db.session.add(task)
    db.session.commit()

    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    try:
        pdf_relpath = file_service.save_template_pdf(file, project_id, task.id)
    except Exception as exc:
        task.status = 'FAILED'
        task.error_message = str(exc)
        task.completed_at = datetime.utcnow()
        db.session.commit()
        status_code = 400 if isinstance(exc, ValueError) else 500
        return error_response('UPLOAD_FAILED', str(exc), status_code)

    from services.task_manager import (
        task_manager,
        process_template_pdf_split_task,
    )
    app = current_app._get_current_object()
    task_manager.submit_task(
        task.id,
        process_template_pdf_split_task,
        project_id,
        pdf_relpath,
        file_service,
        app,
    )
    return success_response({'task_id': task.id}, status_code=202)


@template_assets_bp.route(
    '/<project_id>/template-assets/<asset_id>', methods=['PATCH']
)
def patch_template_asset(project_id: str, asset_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err
    asset, err = _asset_or_404(project_id, asset_id)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    if 'analysis_status' in data:
        return bad_request('analysis_status is task-managed and cannot be set here')

    touched = False
    if 'user_label' in data:
        val = data['user_label']
        asset.user_label = (str(val).strip() or None) if val is not None else None
        touched = True
    if 'analysis_notes' in data:
        asset.analysis_notes = data['analysis_notes']
        touched = True
    if 'analysis_json' in data:
        analysis_data = data['analysis_json']
        if analysis_data is not None and not isinstance(analysis_data, dict):
            return bad_request('analysis_json 必须是一个字典')
        asset.set_analysis(analysis_data)
        asset.user_edited_analysis = True
        touched = True
    if 'sort_order' in data:
        try:
            asset.sort_order = int(data['sort_order'])
            touched = True
        except (TypeError, ValueError):
            return bad_request('sort_order must be an integer')

    if not touched:
        return bad_request('No editable fields supplied')

    asset.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response({'asset': asset.to_dict(include_referenced_pages=True)})


@template_assets_bp.route(
    '/<project_id>/template-assets/<asset_id>', methods=['DELETE']
)
def delete_template_asset(project_id: str, asset_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err
    asset, err = _asset_or_404(project_id, asset_id)
    if err:
        return err

    referenced_page_ids = [p.id for p in asset.pages_referenced]

    # Explicitly clear both the FK and selection_source on referencing pages.
    # We don't rely on the DB FK ON DELETE SET NULL because SQLite does not
    # enforce foreign keys unless PRAGMA foreign_keys=ON (not set here); doing
    # it in the update keeps the reset database-agnostic and puts those pages
    # back into the "未确认" state per PRD §11.
    if referenced_page_ids:
        Page.query.filter(Page.id.in_(referenced_page_ids)).update(
            {
                Page.template_asset_id: None,
                Page.template_selection_source: None,
                Page.template_match_reason: None,
                Page.template_match_confidence: None,
            },
            synchronize_session=False,
        )

    # Commit the DB delete before touching the filesystem: if the commit fails
    # we keep both row and files, rather than orphaning a row whose images are
    # already gone.
    db.session.delete(asset)
    db.session.commit()

    FileService(current_app.config['UPLOAD_FOLDER']).delete_template_asset(
        project_id, asset_id
    )

    return success_response({
        'deleted': True,
        'cleared_page_ids': referenced_page_ids,
    })


@template_assets_bp.route(
    '/<project_id>/template-assets/<asset_id>/reanalyze', methods=['POST']
)
def reanalyze_template_asset(project_id: str, asset_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err
    asset, err = _asset_or_404(project_id, asset_id)
    if err:
        return err

    asset.analysis_status = 'pending'
    asset.analysis_error = None
    db.session.commit()

    analyze_task_id = _enqueue_analyze_template(project_id, asset_id)
    return success_response({'analyze_task_id': analyze_task_id}, status_code=202)


# ---------- 3.3 Page-level template + mode switch ----------


@page_template_bp.route(
    '/<project_id>/pages/<page_id>/template', methods=['PATCH']
)
def patch_page_template(project_id: str, page_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err

    page = Page.query.filter_by(id=page_id, project_id=project_id).first()
    if not page:
        return not_found('Page')

    data = request.get_json(silent=True) or {}
    if not any(k in data for k in ('template_asset_id', 'template_style_text',
                                   'selection_source')):
        return bad_request('No template fields supplied')

    if 'template_asset_id' in data:
        new_asset_id = data['template_asset_id']
        if new_asset_id is not None:
            asset = ProjectTemplateAsset.query.filter_by(
                id=new_asset_id, project_id=project_id
            ).first()
            if not asset:
                return bad_request('template_asset_id does not belong to this project')
        page.template_asset_id = new_asset_id

    if 'template_style_text' in data:
        text = data['template_style_text']
        page.template_style_text = (text or None)

    selection_source = data.get('selection_source', 'manual')
    if selection_source not in VALID_SELECTION_SOURCES:
        return bad_request(
            f"selection_source must be one of {sorted(VALID_SELECTION_SOURCES)}"
        )
    page.template_selection_source = selection_source

    # Manual selection invalidates auto-match metadata
    if selection_source == 'manual':
        page.template_match_reason = None
        page.template_match_confidence = None

    page.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response({'page': page.to_dict()})


@template_mode_bp.route('/<project_id>/template-mode', methods=['PATCH'])
def patch_template_mode(project_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    mode = data.get('mode')
    if mode not in ('single', 'multi'):
        return bad_request("mode must be 'single' or 'multi'")

    if mode == 'multi':
        project.template_mode = 'multi'
        project.updated_at = datetime.utcnow()
        db.session.commit()
        return success_response({'project': project.to_dict()})

    # mode == 'single' — multi → single must specify a unifier (asset / text / both)
    unified_asset_id = data.get('unified_asset_id')
    unified_style_text = data.get('unified_style_text')
    if unified_asset_id is None and not (unified_style_text or '').strip():
        return bad_request(
            'unified_asset_id or unified_style_text is required when switching to single'
        )

    if unified_asset_id is not None:
        asset = ProjectTemplateAsset.query.filter_by(
            id=unified_asset_id, project_id=project_id
        ).first()
        if not asset:
            return bad_request('unified_asset_id does not belong to this project')

    Page.query.filter_by(project_id=project_id).update({
        Page.template_asset_id: unified_asset_id,
        Page.template_style_text: unified_style_text or None,
        Page.template_selection_source: 'batch_apply',
        Page.template_match_reason: None,
        Page.template_match_confidence: None,
    }, synchronize_session=False)
    project.template_mode = 'single'
    project.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response({'project': project.to_dict()})


@template_mode_bp.route(
    '/<project_id>/template-mode/single-with-upload', methods=['POST']
)
def template_mode_single_with_upload(project_id: str):
    """Multi → single while uploading a brand-new unified asset (multipart)."""
    project, err = _project_or_404(project_id)
    if err:
        return err

    if 'image' not in request.files:
        return bad_request("Field 'image' is required")
    file = request.files['image']
    if not file.filename:
        return bad_request('No file selected')
    if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
        return bad_request('Invalid file type. Allowed: png, jpg, jpeg, gif, webp')

    unified_style_text = (request.form.get('unified_style_text') or '').strip() or None

    asset_id = str(uuid.uuid4())
    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    try:
        image_path, thumb_path = file_service.save_template_asset(
            file, project_id, asset_id
        )
    except ValueError as exc:
        return bad_request(str(exc))

    sort_order = (
        db.session.query(db.func.coalesce(db.func.max(ProjectTemplateAsset.sort_order), -1))
        .filter(ProjectTemplateAsset.project_id == project_id)
        .scalar()
    ) + 1
    asset = ProjectTemplateAsset(
        id=asset_id,
        project_id=project_id,
        image_path=image_path,
        thumb_path=thumb_path,
        source='upload',
        analysis_status='pending',
        sort_order=sort_order,
    )
    db.session.add(asset)
    Page.query.filter_by(project_id=project_id).update({
        Page.template_asset_id: asset_id,
        Page.template_style_text: unified_style_text,
        Page.template_selection_source: 'batch_apply',
        Page.template_match_reason: None,
        Page.template_match_confidence: None,
    }, synchronize_session=False)
    project.template_mode = 'single'
    project.updated_at = datetime.utcnow()
    db.session.commit()

    analyze_task_id = _enqueue_analyze_template(project_id, asset_id)

    return success_response({
        'asset': asset.to_dict(include_referenced_pages=True),
        'project': project.to_dict(),
        'analyze_task_id': analyze_task_id,
    }, status_code=201)


# ---------- 3.3 auto-match (project-wide + single-page) ----------


def _enqueue_auto_match(project_id: str, *, page_id: str | None,
                        overwrite_existing: bool, preserve_non_empty: bool):
    from services.task_manager import task_manager, auto_match_templates_task
    from services.ai_service import AIService

    task = Task(
        project_id=project_id,
        task_type=TASK_AUTO_MATCH_TEMPLATES,
        status='PENDING',
    )
    task.set_progress({
        'total_pages': 0,
        'matched': 0,
        'undecided': 0,
        'batch_index': 0,
        'batch_total': 0,
        'scope': 'page' if page_id else 'project',
    })
    db.session.add(task)
    db.session.commit()

    ai_service = AIService()
    app = current_app._get_current_object()
    task_manager.submit_task(
        task.id,
        auto_match_templates_task,
        project_id,
        page_id,
        overwrite_existing,
        preserve_non_empty,
        ai_service,
        app,
    )
    return task.id


@template_assets_bp.route(
    '/<project_id>/template-assets/auto-match', methods=['POST']
)
def auto_match_project(project_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    overwrite_existing = bool(data.get('overwrite_existing', True))
    preserve_non_empty = bool(data.get('preserve_non_empty', False))

    pages = Page.query.filter_by(project_id=project_id).all()
    missing = [p.id for p in pages if not p.get_description_content()]
    if missing:
        return error_response(
            'MISSING_DESCRIPTIONS',
            'All pages must have descriptions before auto-match',
            400,
            extra={'missing_page_ids': missing},
        )

    task_id = _enqueue_auto_match(
        project_id,
        page_id=None,
        overwrite_existing=overwrite_existing,
        preserve_non_empty=preserve_non_empty,
    )
    return success_response({'task_id': task_id}, status_code=202)


@page_template_bp.route(
    '/<project_id>/pages/<page_id>/template/auto-match', methods=['POST']
)
def auto_match_page(project_id: str, page_id: str):
    project, err = _project_or_404(project_id)
    if err:
        return err
    page = Page.query.filter_by(id=page_id, project_id=project_id).first()
    if not page:
        return not_found('Page')
    if not page.get_description_content():
        return error_response(
            'MISSING_DESCRIPTIONS',
            'This page has no description yet',
            400,
            extra={'missing_page_ids': [page.id]},
        )
    has_completed = (
        ProjectTemplateAsset.query
        .filter_by(project_id=project_id, analysis_status='completed')
        .first()
    )
    if not has_completed:
        return error_response(
            'NO_ANALYZED_TEMPLATES',
            'No template assets have completed analysis yet',
            400,
        )

    task_id = _enqueue_auto_match(
        project_id,
        page_id=page_id,
        overwrite_existing=True,
        preserve_non_empty=False,
    )
    return success_response({'task_id': task_id}, status_code=202)
