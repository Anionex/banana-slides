from pathlib import Path

def _register_and_login(client, email: str):
    register_resp = client.post('/api/auth/register', json={
        'email': email,
        'password': 'testpassword123',
        'username': email.split('@')[0],
    })
    reg_data = register_resp.get_json()['data']
    if reg_data.get('access_token'):
        token = reg_data['access_token']
    else:
        login_resp = client.post('/api/auth/login', json={
            'email': email,
            'password': 'testpassword123',
        })
        token = login_resp.get_json()['data']['access_token']
    return f'Bearer {token}', token


def _write_file(path: Path, content: bytes = b'test-file'):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_private_project_file_requires_auth(client, app):
    _register_and_login(client, 'owner@example.com')

    with app.app_context():
        from models import db, Project, User

        owner = User.query.filter_by(email='owner@example.com').first()
        project = Project(user_id=owner.id, creation_type='idea')
        db.session.add(project)
        db.session.flush()
        project.template_image_path = f'{project.id}/template/template.png'
        db.session.commit()

        upload_root = Path(app.config['UPLOAD_FOLDER'])
        _write_file(upload_root / project.template_image_path)

    response = client.get(f'/files/{project.id}/template/template.png')
    assert response.status_code == 401
    assert response.get_json()['error']['code'] == 'UNAUTHORIZED'


def test_project_file_allows_owner_via_query_token_and_blocks_other_user(client, app):
    _, owner_token = _register_and_login(client, 'owner2@example.com')
    other_header, _ = _register_and_login(client, 'other2@example.com')

    with app.app_context():
        from models import db, Project, User

        owner = User.query.filter_by(email='owner2@example.com').first()
        project = Project(user_id=owner.id, creation_type='idea')
        db.session.add(project)
        db.session.flush()
        project.template_image_path = f'{project.id}/template/template.png'
        db.session.commit()

        upload_root = Path(app.config['UPLOAD_FOLDER'])
        _write_file(upload_root / project.template_image_path, b'owner-template')

    own_response = client.get(f'/files/{project.id}/template/template.png?access_token={owner_token}')
    assert own_response.status_code == 200
    assert own_response.data == b'owner-template'

    other_response = client.get(
        f'/files/{project.id}/template/template.png',
        headers={'Authorization': other_header},
    )
    assert other_response.status_code == 404


def test_user_template_and_global_material_are_owner_scoped(client, app):
    _, owner_token = _register_and_login(client, 'owner3@example.com')
    _, other_token = _register_and_login(client, 'other3@example.com')

    with app.app_context():
        from models import db, Material, User, UserTemplate

        owner = User.query.filter_by(email='owner3@example.com').first()

        user_template = UserTemplate(
            user_id=owner.id,
            name='My Template',
            file_path='user-templates/template-1/template.png',
            thumb_path='user-templates/template-1/template-thumb.webp',
            file_size=10,
        )
        material = Material(
            user_id=owner.id,
            project_id=None,
            filename='material_1.png',
            relative_path='materials/material_1.png',
            url='/files/materials/material_1.png',
        )
        db.session.add(user_template)
        db.session.add(material)
        db.session.commit()

        upload_root = Path(app.config['UPLOAD_FOLDER'])
        _write_file(upload_root / user_template.file_path, b'user-template')
        _write_file(upload_root / user_template.thumb_path, b'user-template-thumb')
        _write_file(upload_root / material.relative_path, b'global-material')

        template_id = user_template.id

    template_resp = client.get(f'/files/user-templates/{template_id}/template.png?access_token={owner_token}')
    assert template_resp.status_code == 200
    assert template_resp.data == b'user-template'

    thumb_resp = client.get(f'/files/user-templates/{template_id}/template-thumb.webp?access_token={owner_token}')
    assert thumb_resp.status_code == 200
    assert thumb_resp.data == b'user-template-thumb'

    material_resp = client.get(f'/files/materials/material_1.png?access_token={owner_token}')
    assert material_resp.status_code == 200
    assert material_resp.data == b'global-material'

    forbidden_template = client.get(f'/files/user-templates/{template_id}/template.png?access_token={other_token}')
    assert forbidden_template.status_code == 404

    forbidden_material = client.get(f'/files/materials/material_1.png?access_token={other_token}')
    assert forbidden_material.status_code == 404


def test_reference_file_parse_uses_effective_user_mineru_settings(client, app, monkeypatch, tmp_path):
    _register_and_login(client, 'mineru-owner@example.com')

    with app.app_context():
        from models import db, ReferenceFile, Settings, User, UserSettings

        owner = User.query.filter_by(email='mineru-owner@example.com').first()
        owner_id = owner.id

        global_settings = Settings.get_settings()
        global_settings.mineru_token = 'global-expired-token'
        global_settings.mineru_api_base = 'https://global-mineru.example.test'
        db.session.commit()

        # Allow users to override mineru fields so the test can verify
        from models import SystemConfig
        sys_config = SystemConfig.get_instance()
        sys_config.set_user_editable_fields(
            list(set(sys_config.get_user_editable_fields()) | {'mineru_token', 'mineru_api_base'})
        )
        db.session.commit()

        user_settings = UserSettings.get_or_create_for_user(owner_id)
        user_settings.mineru_token = 'user-valid-token'
        user_settings.mineru_api_base = 'https://user-mineru.example.test'
        db.session.commit()

        file_path = tmp_path / 'reference.pdf'
        file_path.write_bytes(b'%PDF-1.4 test')

        reference_file = ReferenceFile(
            user_id=owner_id,
            filename='reference.pdf',
            file_path='reference_files/reference.pdf',
            file_size=file_path.stat().st_size,
            file_type='pdf',
            parse_status='pending',
        )
        db.session.add(reference_file)
        db.session.commit()
        reference_file_id = reference_file.id

    captured = {}

    class DummyParser:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def parse_file(self, file_path, filename):
            return ('batch-1', '# parsed', 'extract-1', None, 0)

    from controllers import reference_file_controller

    monkeypatch.setattr(reference_file_controller, 'FileParserService', DummyParser)

    reference_file_controller._parse_file_async(
        reference_file_id,
        str(file_path),
        'reference.pdf',
        owner_id,
        app,
    )

    assert captured['mineru_token'] == 'user-valid-token'
    assert captured['mineru_api_base'] == 'https://user-mineru.example.test'

    with app.app_context():
        from models import ReferenceFile

        refreshed = db.session.get(ReferenceFile, reference_file_id)
        assert refreshed.parse_status == 'completed'
        assert refreshed.markdown_content == '# parsed'
