"""Public demo policy and request/task-local configuration.

No request writes Flask's shared config. Worker wrappers carry only plain data,
never a Flask request context or a SQLAlchemy session.
"""
import hashlib
import hmac
import json
import re
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from contextvars import ContextVar
from threading import Thread
from flask import current_app, g, has_app_context, has_request_context, request
from flask.config import Config as FlaskConfig

_task_visitor = ContextVar('public_demo_visitor', default=None)
PROFILES = {
    'inferera': dict(name='Inferera', format='gemini', base='https://api.inferera.com/gemini',
                     text='gemini-3-flash-preview', image='gemini-3-pro-image-preview', caption='gemini-3-flash-preview',
                     signup='https://inferera.com/?aff=17EC', key_hint='使用 Inferera API Key'),
    'apimart': dict(name='APIMart', format='openai', base='https://api.apimart.ai/v1',
                    text='gpt-5.6-sol', image='gpt-image-2', caption='gpt-5.6-luna',
                    signup='https://go.apimart.ai/gh-banana-slides', key_hint='使用 APIMart API Key'),
    'volcengine': dict(name='火山 Agent Plan', format='volcengine', base='https://ark.cn-beijing.volces.com/api/plan/v3',
                       text='doubao-seed-2.1-turbo', image='doubao-seedream-5.0-lite', caption='doubao-seed-2.1-turbo',
                       signup='https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides',
                       key_hint='使用 Agent Plan 订阅专属 Key，普通方舟 Key 不适用'),

}
SECRET_FIELDS = ('mineru_token', 'baidu_api_key', 'elevenlabs_api_key')
DEFAULTS = dict(partner='inferera', image_resolution='2K', image_aspect_ratio='16:9',
                max_description_workers=20, max_image_workers=20, output_language='zh',
                description_generation_mode='streaming', enable_text_reasoning=False,
                text_thinking_budget=1024, enable_image_reasoning=False, image_thinking_budget=1024,
                enable_image_quality_control=False, elevenlabs_enabled=False, elevenlabs_voice_id='',
                mineru_api_base='https://mineru.net', mineru_token='', baidu_api_key='', elevenlabs_api_key='')
CONFIG_FIELDS = {'image_resolution': 'DEFAULT_RESOLUTION', 'image_aspect_ratio': 'DEFAULT_ASPECT_RATIO',
                 'max_description_workers': 'MAX_DESCRIPTION_WORKERS', 'max_image_workers': 'MAX_IMAGE_WORKERS',
                 'output_language': 'OUTPUT_LANGUAGE', 'mineru_api_base': 'MINERU_API_BASE',
                 'mineru_token': 'MINERU_TOKEN', 'baidu_api_key': 'BAIDU_API_KEY',
                 'elevenlabs_api_key': 'ELEVENLABS_API_KEY', 'elevenlabs_voice_id': 'ELEVENLABS_VOICE_ID',
                 'elevenlabs_enabled': 'ELEVENLABS_ENABLED', 'enable_text_reasoning': 'ENABLE_TEXT_REASONING',
                 'text_thinking_budget': 'TEXT_THINKING_BUDGET', 'enable_image_reasoning': 'ENABLE_IMAGE_REASONING',
                 'image_thinking_budget': 'IMAGE_THINKING_BUDGET'}
SITE_MANAGED_FIELDS = {
    'mineru': ('mineru_token', 'PUBLIC_DEMO_MINERU_TOKEN'),
    'baidu': ('baidu_api_key', 'PUBLIC_DEMO_BAIDU_API_KEY'),
}


def enabled():
    return has_app_context() and dict.get(current_app.config, 'PUBLIC_DEMO', False)


def visitor():
    if has_request_context():
        # SSE controllers push a fresh app context, whose g is empty while
        # stream_with_context still retains the original request environ.
        snapshot = getattr(g, 'public_visitor', None) or request.environ.get('banana.public_visitor')
        if snapshot is not None:
            return snapshot
    return _task_visitor.get()


def site_managed_values():
    """Return only credentials explicitly shared by the public-demo operator."""
    if not enabled():
        return {}
    result = {}
    for _, (field, config_key) in SITE_MANAGED_FIELDS.items():
        value = dict.get(current_app.config, config_key, '')
        if isinstance(value, str) and value.strip():
            result[field] = value.strip()
    return result


def site_managed_services():
    fields = site_managed_values()
    return [service for service, (field, _) in SITE_MANAGED_FIELDS.items() if field in fields]


def values():
    v = visitor()
    data = {**DEFAULTS, **(v['config'] if v else {}), **site_managed_values()}
    profile = PROFILES[data['partner']]
    data.update(ai_provider_format=profile['format'], api_base_url=profile['base'],
                text_model=profile['text'], image_model=profile['image'], image_caption_model=profile['caption'],
                api_key=data.get('provider_keys', {}).get(data['partner'], ''),
                openai_image_api_protocol='images')
    return data


def settings_test_scope():
    """A non-discoverable visitor scope that fits Task.project_id's 36 chars."""
    return 'settings-' + visitor()['token'][:27]


def config_overrides():
    data = values()
    result = {key: data[field] for field, key in CONFIG_FIELDS.items()}
    result.update(AI_PROVIDER_FORMAT=data['ai_provider_format'], TEXT_MODEL=data['text_model'],
                  IMAGE_MODEL=data['image_model'], IMAGE_CAPTION_MODEL=data['image_caption_model'],
                  OPENAI_IMAGE_API_PROTOCOL='images', LAZYLLM_API_KEYS='{}')
    for prefix in ('GOOGLE', 'OPENAI', 'VOLCENGINE', 'TEXT', 'IMAGE', 'IMAGE_CAPTION'):
        result[prefix + '_API_KEY'] = data['api_key']
        result[prefix + '_API_BASE'] = data['api_base_url']
    for prefix in ('TEXT', 'IMAGE', 'IMAGE_CAPTION'):
        result[prefix + '_MODEL_SOURCE'] = data['ai_provider_format']
    return result


class PublicConfig(FlaskConfig):
    def __getitem__(self, key):
        if dict.get(self, 'PUBLIC_DEMO', False):
            overrides = config_overrides()
            if key in overrides:
                return overrides[key]
            if any(marker in key for marker in ('API_KEY', 'TOKEN', 'SECRET', 'API_BASE')) and key != 'SECRET_KEY':
                return ''
        return super().__getitem__(key)

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def __contains__(self, key):
        return dict.__contains__(self, key) or (dict.get(self, 'PUBLIC_DEMO', False) and key in config_overrides())


@contextmanager
def visitor_scope(snapshot):
    token = _task_visitor.set(snapshot)
    try:
        yield
    finally:
        _task_visitor.reset(token)


def bind_visitor(fn):
    snapshot = visitor()
    snapshot = json.loads(json.dumps(snapshot)) if snapshot else None
    app = current_app._get_current_object() if enabled() else None
    def run(*args, **kwargs):
        with visitor_scope(snapshot):
            # Create a fresh context for workers that do not establish one.
            # Never copy the caller's g or SQLAlchemy session into a thread.
            if app is not None:
                with app.app_context():
                    return fn(*args, **kwargs)
            return fn(*args, **kwargs)
    return run


class VisitorThreadPoolExecutor(ThreadPoolExecutor):
    def submit(self, fn, /, *args, **kwargs):
        return super().submit(bind_visitor(fn), *args, **kwargs)


class VisitorThread(Thread):
    def __init__(self, *args, target=None, **kwargs):
        super().__init__(*args, target=bind_visitor(target) if target else None, **kwargs)


def as_settings():
    from models import Settings
    data = values()
    fields = {c.name for c in Settings.__table__.columns}
    return Settings(**{k: v for k, v in data.items() if k in fields})


def settings_json():
    from models import Settings
    data = values()
    keys = data.pop('provider_keys', {})
    data['provider_key_lengths'] = {provider: len(keys.get(provider, '') or '') for provider in PROFILES}
    for field in ('api_key', *SECRET_FIELDS):
        data[field + '_length'] = len(data.pop(field, '') or '')
    data.update(description_extra_fields=list(Settings.DEFAULT_EXTRA_FIELDS),
                image_prompt_extra_fields=list(Settings.DEFAULT_IMAGE_PROMPT_FIELDS),
                openai_oauth_connected=False,
                site_managed_services=site_managed_services())
    return data


def install(app):
    from models import db, PublicVisitor
    from utils import error_response, success_response

    @app.route('/api/public-config')
    def public_config():
        return success_response({'enabled': enabled(), 'partners': PROFILES if enabled() else {}})

    @app.route('/api/admin/history', methods=['POST'])
    def admin_history():
        from controllers.project_controller import list_projects
        from flask import make_response
        password = dict.get(app.config, 'PUBLIC_DEMO_ADMIN_PASSWORD', '')
        if not enabled() or not password:
            return error_response('NOT_FOUND', '入口未启用。', 404)
        data = request.get_json(silent=True)
        supplied = data.get('password') if isinstance(data, dict) else None
        if not isinstance(supplied, str) or not hmac.compare_digest(supplied.encode(), password.encode()):
            return error_response('UNAUTHORIZED', '管理员口令错误。', 401)
        # Read-only, separate from the publicly blocked history endpoint.
        response = make_response(list_projects())
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.before_request
    def public_policy():
        if not enabled() or not request.path.startswith('/api/'):
            return None
        path = request.path.rstrip('/')
        if path in ('/api/public-config', '/api/access-code/check', '/api/access-code/verify') or request.method == 'OPTIONS':
            return None
        # Block discovery and destructive project operations at the server too.
        if path == '/api/projects' and request.method == 'GET':
            return error_response('PUBLIC_HISTORY_DISABLED', '公开版不提供历史记录，请使用已保存的 PPT 链接访问。', 403)
        if request.method == 'DELETE' and re.fullmatch(r'/api/projects/[^/]+', path):
            return error_response('PUBLIC_DELETE_DISABLED', '公开版不支持删除项目。', 403)
        if path.startswith('/api/settings/openai-oauth') or path == '/api/settings/active-config':
            return error_response('PUBLIC_SETTINGS_LOCKED', '公开版不提供此设置。', 403)
        raw = request.headers.get('X-User-Token', '')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{20,100}', raw):
            return error_response('VISITOR_REQUIRED', '缺少有效的访客标识，请刷新页面。', 401)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        row = db.session.get(PublicVisitor, digest)
        g.public_visitor = {'token': digest, 'config': json.loads(row.config_json) if row else {}}
        request.environ['banana.public_visitor'] = g.public_visitor
        if path.startswith('/api/projects/settings-'):
            return error_response('TASK_NOT_FOUND', '请从个人设置页查看服务测试。', 404)
        if path == '/api/settings':
            if request.method == 'GET':
                return success_response(settings_json())
            if request.method == 'PUT':
                return update_public_settings(row)
        if path == '/api/settings/reset' and request.method == 'POST':
            if row:
                row.config_json = '{}'
                db.session.commit()
            g.public_visitor['config'] = {}
            return success_response(settings_json())
        if path.startswith('/api/settings/tests/') and request.method == 'POST':
            # Main service tests are reused, but arbitrary provider overrides are not.
            if request.get_json(silent=True):
                return error_response('PUBLIC_SETTINGS_LOCKED', '请先保存设置后再测试，公开版不接受临时模型或接口覆盖。', 400)
        return None


def update_public_settings(row):
    from models import db, PublicVisitor
    from utils import bad_request, success_response
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return bad_request('设置必须是 JSON 对象')
    data = dict(data)
    for managed_field in site_managed_values():
        data.pop(managed_field, None)
    allowed = set(DEFAULTS) - {'mineru_api_base'} | {'api_key'}
    if set(data) - allowed:
        return bad_request('公开版不允许修改模型、接口地址或描述生成字段配置。')
    config = dict(visitor()['config'])
    if 'partner' in data and (not isinstance(data['partner'], str) or data['partner'] not in PROFILES):
        return bad_request('请选择有效的 API 提供商')
    enums = {'image_resolution': ('1K', '2K', '4K'), 'image_aspect_ratio': ('16:9', '21:9', '4:3', '3:2', '5:4', '1:1', '4:5', '2:3', '3:4', '9:16'),
             'output_language': ('zh', 'en', 'ja', 'auto'), 'description_generation_mode': ('streaming', 'parallel')}
    ranges = {'max_description_workers': (1, 20), 'max_image_workers': (1, 20),
              'text_thinking_budget': (1, 8192), 'image_thinking_budget': (1, 8192)}
    for key, val in data.items():
        if key in enums and val not in enums[key]:
            return bad_request(f'{key} 值无效')
        if key in ranges and (type(val) is not int or not ranges[key][0] <= val <= ranges[key][1]):
            return bad_request(f'{key} 超出允许范围')
        if isinstance(DEFAULTS.get(key), bool) and type(val) is not bool:
            return bad_request(f'{key} 必须为布尔值')
        if key in ('api_key', *SECRET_FIELDS, 'elevenlabs_voice_id') and (not isinstance(val, str) or len(val) > 4096):
            return bad_request(f'{key} 值无效')
    config.update({k: v for k, v in data.items() if k not in ('api_key', *SECRET_FIELDS)})
    for key in SECRET_FIELDS:
        if data.get(key):
            config[key] = data[key].strip()
    if data.get('api_key'):
        keys = dict(config.get('provider_keys', {}))
        keys[config.get('partner', 'inferera')] = data['api_key'].strip()
        config['provider_keys'] = keys
    if row is None:
        row = PublicVisitor(token_hash=visitor()['token'])
        db.session.add(row)
    row.config_json = json.dumps(config)
    db.session.commit()
    g.public_visitor = {'token': row.token_hash, 'config': config}
    request.environ['banana.public_visitor'] = g.public_visitor
    return success_response(settings_json())
