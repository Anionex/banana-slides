import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from flask import Flask, current_app
from services.public_demo import PublicConfig, VisitorThreadPoolExecutor, install
from models import db


@pytest.fixture
def public_app(tmp_path):
    app = Flask(__name__)
    app.config = PublicConfig(app.root_path, dict(app.config))
    app.config.update(PUBLIC_DEMO=True, TESTING=True,
                      SQLALCHEMY_DATABASE_URI='sqlite:///' + str(tmp_path / 'public.db'),
                      GOOGLE_API_KEY='server-secret', TEXT_API_KEY='server-text-secret',
                      MINERU_TOKEN='server-mineru', TEXT_MODEL='server-model')
    db.init_app(app)
    install(app)
    with app.app_context():
        db.create_all()
    yield app


A = {'X-User-Token': 'visitor-a-0000000000000000000000000'}
B = {'X-User-Token': 'visitor-b-0000000000000000000000000'}


def _register_asset_routes(app, tmp_path):
    from controllers.material_controller import material_bp, material_global_bp
    from controllers.template_controller import user_template_bp, user_style_template_bp
    from controllers.reference_file_controller import reference_file_bp
    app.config.update(UPLOAD_FOLDER=str(tmp_path / 'uploads'), ALLOWED_EXTENSIONS={'png'})
    for blueprint in (material_bp, material_global_bp, user_template_bp, user_style_template_bp):
        app.register_blueprint(blueprint)
    app.register_blueprint(reference_file_bp, url_prefix='/api/reference-files')


def _asset_png():
    from io import BytesIO
    from PIL import Image
    stream = BytesIO()
    Image.new('RGB', (32, 32), 'white').save(stream, format='PNG')
    stream.seek(0)
    return stream


def test_public_asset_lists_and_deletes_are_visitor_scoped(public_app, tmp_path):
    _register_asset_routes(public_app, tmp_path)
    client = public_app.test_client()
    uploaded = client.post('/api/materials/upload', headers=A, data={'file': (_asset_png(), 'asset.png')})
    assert uploaded.status_code == 201
    material = uploaded.json['data']
    template_response = client.post('/api/user-templates', headers=A, data={'template_image': (_asset_png(), 'template.png')})
    assert template_response.status_code == 200
    template = template_response.json['data']
    style_response = client.post('/api/user-style-templates', headers=A, json={'name': 'private style', 'description': 'private description'})
    assert style_response.status_code == 200
    style = style_response.json['data']
    for route, field, item_id in (
        ('/api/materials', 'materials', material['id']),
        ('/api/user-templates', 'templates', template['template_id']),
        ('/api/user-style-templates', 'templates', style['id']),
    ):
        assert len(client.get(route, headers=A).json['data'][field]) == 1
        assert client.get(route, headers=B).json['data'][field] == []
        assert client.delete(route + '/' + item_id, headers=B).status_code == 404
        assert len(client.get(route, headers=A).json['data'][field]) == 1
    assert client.get('/api/materials?project_id=all', headers=B).json['data']['materials'] == []
    from models import Project
    with public_app.app_context():
        project = Project(creation_type='idea')
        db.session.add(project)
        db.session.commit()
        project_id = project.id
    association = {'project_id': project_id, 'material_urls': [material['url']]}
    assert client.post('/api/materials/associate', headers=B, json=association).json['data']['count'] == 0
    assert client.post('/api/materials/associate', headers=A, json=association).json['data']['count'] == 1
    assert client.get('/api/projects/' + project_id + '/materials', headers=B).json['data']['materials'] == []
    assert len(client.get('/api/projects/' + project_id + '/materials', headers=A).json['data']['materials']) == 1
    assert client.get('/api/materials/' + material['id'] + '/caption', headers=B).status_code == 404
    assert client.get('/api/materials/by-url', headers=B, query_string={'url': material['url']}).status_code == 404
    assert client.post('/api/materials/download', headers=B, json={'material_ids': [material['id']]}).status_code == 404
    assert client.post('/api/materials/download', headers=A, json={'material_ids': [material['id']]}).status_code == 200
    for route, item_id in (('/api/materials', material['id']), ('/api/user-templates', template['template_id']), ('/api/user-style-templates', style['id'])):
        assert client.delete(route + '/' + item_id, headers=A).status_code == 200


def test_public_legacy_assets_stay_private_and_normal_mode_keeps_them(public_app, tmp_path):
    from models import Material, UserTemplate, UserStyleTemplate
    _register_asset_routes(public_app, tmp_path)
    with public_app.app_context():
        db.session.add_all([
            Material(filename='legacy.png', relative_path='materials/legacy.png', url='/files/materials/legacy.png'),
            UserTemplate(file_path='legacy/template.png'),
            UserStyleTemplate(name='legacy', description='unattributed'),
        ])
        db.session.commit()
    client = public_app.test_client()
    for route, field in (('/api/materials', 'materials'), ('/api/user-templates', 'templates'), ('/api/user-style-templates', 'templates')):
        assert client.get(route, headers=A).json['data'][field] == []
    public_app.config['PUBLIC_DEMO'] = False
    for route, field in (('/api/materials', 'materials'), ('/api/user-templates', 'templates'), ('/api/user-style-templates', 'templates')):
        assert len(client.get(route).json['data'][field]) == 1


def test_worker_created_material_inherits_visitor_owner(public_app, tmp_path):
    from models import Material
    _register_asset_routes(public_app, tmp_path)

    @public_app.post('/api/worker-asset-test')
    def create_in_worker():
        def create():
            row = Material(filename='worker.png', relative_path='materials/worker.png', url='/files/materials/worker.png')
            db.session.add(row)
            db.session.commit()
            return row.id
        with VisitorThreadPoolExecutor(max_workers=1) as pool:
            return {'id': pool.submit(create).result(timeout=10)}

    client = public_app.test_client()
    assert client.post('/api/worker-asset-test', headers=A).status_code == 200
    assert len(client.get('/api/materials', headers=A).json['data']['materials']) == 1
    assert client.get('/api/materials', headers=B).json['data']['materials'] == []


def test_reference_file_lists_content_and_mutations_are_private(public_app, tmp_path):
    from io import BytesIO
    from models import Project
    _register_asset_routes(public_app, tmp_path)
    client = public_app.test_client()
    response = client.post('/api/reference-files/upload', headers=A, data={'file': (BytesIO(b'# private text'), 'private.md')})
    assert response.status_code == 200
    file_id = response.json['data']['file']['id']
    with public_app.app_context():
        project = Project(creation_type='idea')
        db.session.add(project)
        db.session.commit()
        project_id = project.id
    for scope in ('all', 'none', 'global'):
        assert client.get('/api/reference-files/project/' + scope, headers=B).json['data']['files'] == []
    base = '/api/reference-files/' + file_id
    assert client.get(base, headers=B).status_code == 404
    assert client.delete(base, headers=B).status_code == 404
    for action in ('parse', 'associate', 'dissociate'):
        assert client.post(base + '/' + action, headers=B, json={'project_id': project_id}).status_code == 404
    assert client.get(base, headers=A).status_code == 200
    assert client.post(base + '/associate', headers=A, json={'project_id': project_id}).status_code == 200
    assert client.get('/api/reference-files/project/' + project_id, headers=B).json['data']['files'] == []
    assert client.post(base + '/dissociate', headers=A).status_code == 200
    assert client.delete(base, headers=A).status_code == 200


def test_settings_isolation_switch_reset_and_locked_fields(public_app):
    client = public_app.test_client()
    assert client.get('/api/settings').status_code == 401
    assert client.put('/api/settings', headers=A, json={'api_key': 'a-secret', 'partner': 'apimart'}).status_code == 200
    assert client.get('/api/settings', headers=B).json['data']['api_key_length'] == 0
    response = client.get('/api/settings', headers=A)
    assert response.json['data']['api_key_length'] == 8
    assert response.json['data']['provider_key_lengths'] == {'inferera': 0, 'apimart': 8, 'volcengine': 0}
    assert client.get('/api/settings', headers=B).json['data']['provider_key_lengths'] == {'inferera': 0, 'apimart': 0, 'volcengine': 0}
    assert b'a-secret' not in response.data and b'server-secret' not in response.data
    assert client.put('/api/settings', headers=A, json={'partner': 'inferera'}).json['data']['api_key_length'] == 0
    assert client.put('/api/settings', headers=A, json={'partner': 'apimart'}).json['data']['api_key_length'] == 8
    for payload in ({'text_model': 'hacked'}, {'api_base_url': 'http://evil.example'}, {'description_extra_fields': ['custom']}, {'image_prompt_extra_fields': []}):
        assert client.put('/api/settings', headers=A, json=payload).status_code == 400
    assert client.post('/api/settings/tests/text-model', headers=A, json={'api_key': 'override'}).status_code == 400
    assert client.post('/api/settings/reset', headers=A).json['data']['api_key_length'] == 0
    assert client.get('/api/settings', headers=B).json['data']['partner'] == 'inferera'


def test_history_deletion_and_global_config_blocked(public_app):
    client = public_app.test_client()
    for method, url in [('get', '/api/projects'), ('get', '/api/projects/?limit=1'), ('delete', '/api/projects/a-project'), ('get', '/api/settings/active-config'), ('get', '/api/settings/openai-oauth/authorize'), ('post', '/api/settings/openai-oauth/disconnect')]:
        assert getattr(client, method)(url, headers=A).status_code == 403
    assert client.get('/api/public-config').json['data']['enabled'] is True


def test_config_isolation_in_nested_workers_and_no_server_fallback(public_app):
    client = public_app.test_client()
    for headers, key in ((A, 'secret-A'), (B, 'secret-B')):
        client.put('/api/settings', headers=headers, json={'partner': 'apimart', 'api_key': key})

    def worker():
        with public_app.app_context():
            from services.ai_providers import _resolve_setting
            from models import Settings
            with VisitorThreadPoolExecutor(max_workers=1) as nested:
                nested_key = nested.submit(lambda: current_key()).result(timeout=5)
            return current_app.config['TEXT_API_KEY'], nested_key, _resolve_setting('MINERU_TOKEN'), Settings.get_settings().api_key

    def current_key():
        with public_app.app_context():
            return current_app.config.get('GOOGLE_API_KEY')

    def request_work(headers):
        with public_app.test_request_context('/api/settings', headers=headers):
            public_app.preprocess_request()
            with public_app.app_context():
                # Streaming controllers push a second app context.
                assert current_key() == ('secret-A' if headers == A else 'secret-B')
            with VisitorThreadPoolExecutor(max_workers=1) as pool:
                assert pool.submit(lambda: current_app.config['TEXT_API_KEY']).result(timeout=5) == ('secret-A' if headers == A else 'secret-B')
                return pool.submit(worker).result(timeout=10)

    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = list(pool.map(request_work, [A, B]))
    assert a == ('secret-A', 'secret-A', '', 'secret-A')
    assert b == ('secret-B', 'secret-B', '', 'secret-B')
    assert dict.__getitem__(public_app.config, 'GOOGLE_API_KEY') == 'server-secret'
    with public_app.app_context():
        assert current_app.config.get('GOOGLE_API_KEY') == ''


def test_invalid_settings_are_atomic(public_app):
    client = public_app.test_client()
    for body in ({'partner': 'unknown'}, {'api_key': ['secret']}, {'max_image_workers': 100}, {'enable_text_reasoning': 'yes'}, {'image_resolution': '16K'}):
        assert client.put('/api/settings', headers=A, json=body).status_code == 400
    assert client.get('/api/settings', headers=A).json['data']['partner'] == 'inferera'


def test_public_settings_accept_main_ratios_and_budget_bounds(public_app):
    client = public_app.test_client()
    for ratio in ('16:9', '21:9', '4:3', '3:2', '5:4', '1:1', '4:5', '2:3', '3:4', '9:16'):
        saved = client.put('/api/settings', headers=A, json={'image_aspect_ratio': ratio})
        assert saved.status_code == 200
        assert client.get('/api/settings', headers=A).json['data']['image_aspect_ratio'] == ratio
    for field in ('text_thinking_budget', 'image_thinking_budget'):
        for valid in (1, 8192):
            assert client.put('/api/settings', headers=A, json={field: valid}).status_code == 200
        for invalid in (0, 8193, True, '1024'):
            assert client.put('/api/settings', headers=A, json={field: invalid}).status_code == 400
        assert client.get('/api/settings', headers=A).json['data'][field] == 8192


def test_service_test_results_and_baidu_credentials_are_private(public_app, monkeypatch):
    from controllers.settings_controller import settings_bp, _get_baidu_credentials
    from config import Config
    from models import Task
    from services.public_demo import settings_test_scope
    public_app.register_blueprint(settings_bp)
    monkeypatch.setattr(Config, 'BAIDU_API_KEY', 'server-baidu-secret')
    with public_app.test_request_context('/api/settings', headers=A):
        public_app.preprocess_request()
        with pytest.raises(ValueError, match='BAIDU_API_KEY'):
            _get_baidu_credentials()
        task = Task(project_id=settings_test_scope(), task_type='TEST_TEXT_MODEL', status='COMPLETED')
        db.session.add(task)
        db.session.commit()
        task_id, scope = task.id, task.project_id
    client = public_app.test_client()
    assert client.get(f'/api/settings/tests/{task_id}/status', headers=A).status_code == 200
    assert client.get(f'/api/settings/tests/{task_id}/status', headers=B).status_code == 404
    assert client.get(f'/api/projects/{scope}/tasks/{task_id}', headers=B).status_code == 404


def test_nonpublic_settings_keep_normal_routes(public_app):
    public_app.config['PUBLIC_DEMO'] = False
    assert public_app.test_client().get('/api/public-config').json['data'] == {'enabled': False, 'partners': {}}
    with public_app.app_context():
        assert current_app.config['GOOGLE_API_KEY'] == 'server-secret'


def test_admin_history_requires_env_password_and_does_not_unlock_public_routes(public_app):
    from models import Project
    client = public_app.test_client()
    endpoint = '/api/admin/history'
    assert client.post(endpoint, headers=A, json={'password': 'owner-password'}).status_code == 404
    public_app.config['PUBLIC_DEMO_ADMIN_PASSWORD'] = 'owner-password-口令'
    for payload in ({}, {'password': ''}, {'password': 'wrong'}, {'password': None}, {'password': ['invalid']}):
        assert client.post(endpoint, headers=A, json=payload).status_code == 401
    with public_app.app_context():
        db.session.add_all([Project(idea_prompt=f'Admin history {i}') for i in range(3)])
        db.session.commit()
    response = client.post(endpoint + '?limit=2&offset=0', headers=A, json={'password': 'owner-password-口令'})
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'no-store'
    data = response.json['data']
    assert data['total'] == 3 and len(data['projects']) == 2
    second = client.post(endpoint + '?limit=2&offset=2', headers=A, json={'password': 'owner-password-口令'}).json['data']
    assert len(second['projects']) == 1
    assert second['projects'][0]['project_id'] not in [p['project_id'] for p in data['projects']]
    assert b'owner-password' not in response.data and b'server-secret' not in response.data
    assert client.get('/api/projects', headers=A).status_code == 403
    assert client.delete('/api/projects/' + data['projects'][0]['project_id'], headers=A).status_code == 403
    assert client.get('/api/settings', headers=A).json['data']['api_key_length'] == 0
    public_app.config['PUBLIC_DEMO_ADMIN_PASSWORD'] = 'rotated'
    assert client.post(endpoint, headers=A, json={'password': 'owner-password-口令'}).status_code == 401
    public_app.config['PUBLIC_DEMO'] = False
    assert client.post(endpoint, headers=A, json={'password': 'rotated'}).status_code == 404
