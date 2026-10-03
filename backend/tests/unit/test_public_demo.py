import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
import pytest
from flask import Flask, current_app
from services.public_demo import PublicConfig, VisitorThreadPoolExecutor, install
from models import db


@pytest.fixture
def public_app(tmp_path):
    from services import public_demo
    with public_demo._feedback_lock:
        public_demo._feedback_last_sent.clear()
        public_demo._feedback_accept_times.clear()
    app = Flask(__name__)
    app.config = PublicConfig(app.root_path, dict(app.config))
    app.config.update(PUBLIC_DEMO=True, TESTING=True,
                      SQLALCHEMY_DATABASE_URI='sqlite:///' + str(tmp_path / 'public.db'),
                      GOOGLE_API_KEY='server-secret', TEXT_API_KEY='server-text-secret',
                      MINERU_TOKEN='server-mineru', TEXT_MODEL='server-model',
                      PUBLIC_DEMO_MINERU_TOKEN='', PUBLIC_DEMO_BAIDU_API_KEY='')
    db.init_app(app)
    install(app)
    with app.app_context():
        db.create_all()
    yield app
    with public_demo._feedback_lock:
        public_demo._feedback_last_sent.clear()
        public_demo._feedback_accept_times.clear()


A = {'X-User-Token': 'visitor-a-0000000000000000000000000'}
B = {'X-User-Token': 'visitor-b-0000000000000000000000000'}


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


def test_existing_volcengine_visitor_uses_current_agent_plan_image_model(public_app):
    from models import PublicVisitor
    from services.public_demo import visitor_scope, config_overrides

    token_hash = hashlib.sha256(A['X-User-Token'].encode()).hexdigest()
    old_config = {'partner': 'volcengine', 'provider_keys': {'volcengine': 'saved-key'},
                  'image_model': 'doubao-seedream-5.0-lite'}
    with public_app.app_context():
        db.session.add(PublicVisitor(token_hash=token_hash, config_json=json.dumps(old_config)))
        db.session.commit()
    client = public_app.test_client()
    settings = client.get('/api/settings', headers=A).json['data']
    assert settings['image_model'] == 'doubao-seedream-5-0-pro'
    assert settings['text_model'] == settings['image_caption_model'] == 'doubao-seed-2.1-turbo'
    assert settings['api_key_length'] == len('saved-key')
    assert client.get('/api/public-config').json['data']['partners']['volcengine']['image'] == settings['image_model']
    with public_app.app_context(), visitor_scope({'token': token_hash, 'config': old_config}):
        overrides = config_overrides()
        assert overrides['IMAGE_MODEL'] == settings['image_model']
        assert overrides['IMAGE_API_BASE'] == 'https://ark.cn-beijing.volces.com/api/plan/v3'
        assert overrides['IMAGE_API_KEY'] == 'saved-key'
        assert json.loads(db.session.get(PublicVisitor, token_hash).config_json) == old_config


def test_history_deletion_and_global_config_blocked(public_app):
    client = public_app.test_client()
    for method, url in [('get', '/api/projects'), ('get', '/api/projects/?limit=1'), ('delete', '/api/projects/a-project'), ('get', '/api/settings/active-config'), ('get', '/api/settings/openai-oauth/authorize'), ('post', '/api/settings/openai-oauth/disconnect')]:
        assert getattr(client, method)(url, headers=A).status_code == 403
    assert client.get('/api/public-config').json['data']['enabled'] is True


def test_public_feedback_is_saved_and_only_visible_with_admin_password(public_app):
    from models import Feedback

    public_app.config['PUBLIC_DEMO_ADMIN_PASSWORD'] = 'feedback-admin-secret'
    client = public_app.test_client()
    assert client.post('/api/feedback', json={'message': '生成卡住了', 'page': '/app'}).status_code == 401
    assert client.post('/api/feedback', headers=A, json={'message': '  ', 'page': '/app'}).status_code == 400
    assert client.post('/api/feedback', headers=A, json={
        'message': '恶意邮箱', 'email': 'user@example.com?bcc=attacker%40evil.com', 'page': '/app',
    }).status_code == 400
    assert client.post('/api/feedback', headers=A, json={'message': '测试机器人', 'website': 'spam.example'}).status_code == 200
    with public_app.app_context():
        assert Feedback.query.count() == 0

    sent = client.post('/api/feedback', headers=A, json={
        'message': '  生成卡住了  ', 'email': 'user@example.com', 'page': '/app',
    })
    assert sent.status_code == 200
    assert sent.json['data']['received'] is True
    assert client.post('/api/feedback', headers=A, json={'message': '再发一次', 'page': '/app'}).status_code == 429
    assert client.post('/api/admin/feedback', headers=A, json={'password': 'wrong'}).status_code == 401
    response = client.post('/api/admin/feedback?limit=20&offset=0', headers=B,
                           json={'password': 'feedback-admin-secret'})
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'no-store'
    assert response.json['data']['total'] == 1
    assert response.json['data']['items'][0]['message'] == '生成卡住了'
    assert response.json['data']['items'][0]['reply_email'] == 'user@example.com'
    assert response.json['data']['items'][0]['page_path'] == '/app'
    assert client.post('/api/admin/feedback?limit=20&offset=1', headers=B,
                       json={'password': 'feedback-admin-secret'}).json['data']['items'] == []


def test_public_feedback_pasted_image_is_private_and_readable(public_app):
    from PIL import Image
    from models import Feedback

    public_app.config['PUBLIC_DEMO_ADMIN_PASSWORD'] = 'feedback-admin-secret'
    png = io.BytesIO()
    Image.new('RGB', (32, 24), 'yellow').save(png, format='PNG')
    content = png.getvalue()
    client = public_app.test_client()
    sent = client.post('/api/feedback', headers=A, data={
        'message': '', 'page': '/project/example/preview',
        'images': (io.BytesIO(content), 'screenshot.png'),
    }, content_type='multipart/form-data')
    assert sent.status_code == 200
    with public_app.app_context():
        assert Feedback.query.one().message == '（图片反馈）'
    listing = client.post('/api/admin/feedback', headers=B, json={'password': 'feedback-admin-secret'}).json['data']['items']
    report = listing[0]
    assert len(report['images']) == 1
    assert 'data' not in report['images'][0]
    image_path = f"/api/admin/feedback/{report['id']}/images/{report['images'][0]['id']}"
    assert client.get(image_path, headers=A).status_code == 405
    assert client.post(image_path, headers=A, json={'password': 'wrong'}).status_code == 401
    image_response = client.post(image_path, headers=A, json={'password': 'feedback-admin-secret'})
    assert image_response.status_code == 200
    assert image_response.mimetype == 'image/png'
    assert image_response.data == content
    assert image_response.headers['Cache-Control'] == 'no-store'


def test_public_feedback_text_only_multipart_still_works(public_app):
    client = public_app.test_client()
    sent = client.post('/api/feedback', headers=A, data={
        'message': '只有文字的问题', 'page': '/app', 'email': '',
    }, content_type='multipart/form-data')
    assert sent.status_code == 200
    assert sent.json['data']['received'] is True


def test_public_feedback_rejects_invalid_or_oversized_images(public_app):
    from PIL import Image

    client = public_app.test_client()
    gif = io.BytesIO()
    Image.new('RGB', (2, 2)).save(gif, format='GIF')
    assert client.post('/api/feedback', headers=A, data={
        'message': '截图', 'page': '/app', 'images': (io.BytesIO(gif.getvalue()), 'image.gif'),
    }, content_type='multipart/form-data').status_code == 400
    assert client.post('/api/feedback', headers=A, data={
        'message': '截图', 'page': '/app', 'images': (io.BytesIO(b'x' * (4 * 1024 * 1024 + 1)), 'huge.png'),
    }, content_type='multipart/form-data').status_code == 413


def test_public_feedback_blocks_rotating_tokens_and_external_page_links(public_app):
    from models import Feedback

    client = public_app.test_client()
    for index in range(20):
        response = client.post('/api/feedback', headers={'X-User-Token': f'feedback-visitor-{index:03d}-token'},
                               json={'message': f'问题 {index}', 'page': '/\\evil.example/path'})
        assert response.status_code == 200
    blocked = client.post('/api/feedback', headers={'X-User-Token': 'feedback-visitor-999-token'},
                          json={'message': 'should be limited', 'page': '/app'})
    assert blocked.status_code == 429
    with public_app.app_context():
        assert Feedback.query.count() == 20
        assert {row.page_path for row in Feedback.query.all()} == {'/'}


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


def test_legacy_numeric_switches_can_be_saved_from_settings_page(public_app):
    from models import PublicVisitor

    token_hash = hashlib.sha256(A['X-User-Token'].encode()).hexdigest()
    with public_app.app_context():
        db.session.add(PublicVisitor(token_hash=token_hash, config_json=json.dumps({
            'enable_text_reasoning': 0, 'enable_image_reasoning': 1,
            'output_language': 'zh',
        })))
        db.session.commit()

    client = public_app.test_client()
    loaded = client.get('/api/settings', headers=A).json['data']
    assert loaded['enable_text_reasoning'] is False
    assert loaded['enable_image_reasoning'] is True
    saved = client.put('/api/settings', headers=A, json={
        'enable_text_reasoning': loaded['enable_text_reasoning'],
        'enable_image_reasoning': loaded['enable_image_reasoning'],
        'output_language': 'en',
    })
    assert saved.status_code == 200
    assert client.get('/api/settings', headers=A).json['data']['output_language'] == 'en'
    with public_app.app_context():
        config = json.loads(db.session.get(PublicVisitor, token_hash).config_json)
        assert config['enable_text_reasoning'] is False
        assert config['enable_image_reasoning'] is True


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


def test_explicit_site_managed_services_override_visitor_secrets_without_exposure(public_app):
    from controllers.settings_controller import settings_bp, _get_baidu_credentials
    from models import PublicVisitor, Settings
    from services.ai_providers import _resolve_setting
    public_app.register_blueprint(settings_bp)
    public_app.config.update(PUBLIC_DEMO_MINERU_TOKEN='shared-mineru-secret',
                             PUBLIC_DEMO_BAIDU_API_KEY='shared-baidu-secret')
    client = public_app.test_client()
    response = client.put('/api/settings', headers=A, json={
        'mineru_token': 'visitor-mineru-secret',
        'baidu_api_key': 'visitor-baidu-secret',
    })
    assert response.status_code == 200
    data = response.json['data']
    assert data['site_managed_services'] == ['mineru', 'baidu']
    assert data['mineru_token_length'] == len('shared-mineru-secret')
    assert data['baidu_api_key_length'] == len('shared-baidu-secret')
    assert b'shared-' not in response.data and b'visitor-' not in response.data
    with public_app.app_context():
        token_hash = hashlib.sha256(A['X-User-Token'].encode()).hexdigest()
        row = db.session.get(PublicVisitor, token_hash)
        assert 'mineru' not in row.config_json and 'baidu' not in row.config_json
    with public_app.test_request_context('/api/settings', headers=A):
        public_app.preprocess_request()
        assert _resolve_setting('MINERU_TOKEN') == 'shared-mineru-secret'
        assert _get_baidu_credentials() == 'shared-baidu-secret'
        assert Settings.get_settings().mineru_token == 'shared-mineru-secret'
        with VisitorThreadPoolExecutor(max_workers=1) as pool:
            value = pool.submit(lambda: current_app.config['BAIDU_API_KEY']).result(timeout=5)
            assert value == 'shared-baidu-secret'
    reset = client.post('/api/settings/reset', headers=A).json['data']
    assert reset['site_managed_services'] == ['mineru', 'baidu']
    assert reset['mineru_token_length'] == len('shared-mineru-secret')


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
