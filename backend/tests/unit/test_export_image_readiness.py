import os

from PIL import Image

from models import db, Page, Project, Task


def _create_project_with_pages(app, missing_file=False):
    with app.app_context():
        project = Project(creation_type='idea', idea_prompt='export readiness')
        db.session.add(project)
        db.session.flush()

        pages_dir = os.path.join(app.config['UPLOAD_FOLDER'], project.id, 'pages')
        os.makedirs(pages_dir, exist_ok=True)
        existing_rel_path = f'{project.id}/pages/slide-1.png'
        Image.new('RGB', (320, 180), color='orange').save(
            os.path.join(app.config['UPLOAD_FOLDER'], existing_rel_path)
        )

        ready_page = Page(
            project_id=project.id,
            order_index=0,
            generated_image_path=existing_rel_path,
            status='COMPLETED',
        )
        blocked_page = Page(project_id=project.id, order_index=1, status='DRAFT')
        if missing_file:
            blocked_page.generated_image_path = f'{project.id}/pages/missing.png'
            blocked_page.status = 'COMPLETED'

        db.session.add_all([ready_page, blocked_page])
        db.session.commit()
        return project.id, ready_page.id, blocked_page.id


def _create_project_with_image_path_directory(app):
    with app.app_context():
        project = Project(creation_type='idea', idea_prompt='export directory path')
        db.session.add(project)
        db.session.flush()

        rel_dir_path = f'{project.id}/pages/not-a-file.png'
        os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], rel_dir_path), exist_ok=True)

        page = Page(
            project_id=project.id,
            order_index=0,
            generated_image_path=rel_dir_path,
            status='COMPLETED',
        )
        db.session.add(page)
        db.session.commit()
        return project.id, page.id


def _assert_missing_images(response, missing_page_id):
    assert response.status_code == 400
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXPORT_PAGES_MISSING_IMAGES'
    assert missing_page_id in payload['error']['missing_page_ids']
    assert 'Generate images for all selected pages first' in payload['error']['message']


def test_pptx_export_rejects_any_selected_page_without_image(client, app):
    project_id, ready_page_id, missing_page_id = _create_project_with_pages(app)

    all_pages_response = client.get(f'/api/projects/{project_id}/export/pptx')
    _assert_missing_images(all_pages_response, missing_page_id)

    selected_ready_response = client.get(
        f'/api/projects/{project_id}/export/pptx?page_ids={ready_page_id}'
    )
    assert selected_ready_response.status_code == 200


def test_pdf_images_and_editable_exports_share_missing_image_validation(client, app):
    project_id, _, missing_page_id = _create_project_with_pages(app)

    for method, url in [
        ('get', f'/api/projects/{project_id}/export/pdf'),
        ('get', f'/api/projects/{project_id}/export/images'),
        ('post', f'/api/projects/{project_id}/export/editable-pptx'),
    ]:
        if method == 'post':
            response = client.post(url, json={})
        else:
            response = client.get(url)
        _assert_missing_images(response, missing_page_id)


def test_export_rejects_stale_generated_image_path(client, app):
    project_id, _, stale_page_id = _create_project_with_pages(app, missing_file=True)

    response = client.get(f'/api/projects/{project_id}/export/pdf')

    assert response.status_code == 400
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXPORT_IMAGE_FILES_MISSING'
    assert stale_page_id in payload['error']['missing_page_ids']
    assert 'Regenerate those pages first' in payload['error']['message']


def test_export_rejects_generated_image_path_that_points_to_directory(client, app):
    project_id, page_id = _create_project_with_image_path_directory(app)

    response = client.get(f'/api/projects/{project_id}/export/images')

    assert response.status_code == 400
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXPORT_IMAGE_FILES_MISSING'
    assert page_id in payload['error']['missing_page_ids']


def test_export_rejects_unknown_selected_page_id_in_query(client, app):
    project_id, ready_page_id, _ = _create_project_with_pages(app)

    response = client.get(
        f'/api/projects/{project_id}/export/pptx?page_ids={ready_page_id},missing-page-id'
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXPORT_PAGES_NOT_FOUND'
    assert payload['error']['missing_page_ids'] == ['missing-page-id']


def test_editable_export_rejects_unknown_selected_page_id_in_body(client, app):
    project_id, ready_page_id, _ = _create_project_with_pages(app)

    response = client.post(
        f'/api/projects/{project_id}/export/editable-pptx',
        json={'page_ids': [ready_page_id, 'missing-page-id']},
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert payload['success'] is False
    assert payload['error']['code'] == 'EXPORT_PAGES_NOT_FOUND'
    assert payload['error']['missing_page_ids'] == ['missing-page-id']


def test_editable_export_task_fails_if_image_file_disappears_before_execution(app, monkeypatch):
    from services.file_service import FileService
    from services.task_manager import export_editable_pptx_with_recursive_analysis_task

    project_id, ready_page_id, _ = _create_project_with_pages(app)

    with app.app_context():
        page = db.session.get(Page, ready_page_id)
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], page.generated_image_path)
        os.remove(image_path)

        task = Task(project_id=project_id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
        db.session.add(task)
        db.session.commit()
        task_id = task.id

    def fail_if_called(*args, **kwargs):
        raise AssertionError('export service should not run when a selected image file is missing')

    monkeypatch.setattr(
        'services.export_service.ExportService.create_editable_pptx_with_recursive_analysis',
        fail_if_called,
    )

    export_editable_pptx_with_recursive_analysis_task(
        task_id=task_id,
        project_id=project_id,
        filename='editable.pptx',
        file_service=FileService(app.config['UPLOAD_FOLDER']),
        max_depth=1,
        max_workers=1,
        page_ids=[ready_page_id],
        app=app,
    )

    with app.app_context():
        task = db.session.get(Task, task_id)
        assert task.status == 'FAILED'
        assert 'selected pages are missing generated image files' in task.error_message
        assert ready_page_id in task.error_message


def test_editable_export_task_fails_if_selected_page_disappears_before_execution(app, monkeypatch):
    from services.file_service import FileService
    from services.task_manager import export_editable_pptx_with_recursive_analysis_task

    project_id, ready_page_id, blocked_page_id = _create_project_with_pages(app)

    with app.app_context():
        db.session.delete(db.session.get(Page, blocked_page_id))
        task = Task(project_id=project_id, task_type='EXPORT_EDITABLE_PPTX', status='PENDING')
        db.session.add(task)
        db.session.commit()
        task_id = task.id

    def fail_if_called(*args, **kwargs):
        raise AssertionError('export service should not run when a selected page is missing')

    monkeypatch.setattr(
        'services.export_service.ExportService.create_editable_pptx_with_recursive_analysis',
        fail_if_called,
    )

    export_editable_pptx_with_recursive_analysis_task(
        task_id=task_id,
        project_id=project_id,
        filename='editable.pptx',
        file_service=FileService(app.config['UPLOAD_FOLDER']),
        max_depth=1,
        max_workers=1,
        page_ids=[ready_page_id, blocked_page_id],
        app=app,
    )

    with app.app_context():
        task = db.session.get(Task, task_id)
        assert task.status == 'FAILED'
        assert 'selected page IDs were not found' in task.error_message
        assert blocked_page_id in task.error_message
