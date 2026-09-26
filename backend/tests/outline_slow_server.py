"""Isolated HTTP fixture: real routes/SQLite, deliberately slow model.

Run with DATABASE_PATH pointing to a disposable database. Never use this as
a production entry point. The browser test uses a 70s delay, beyond nginx's
default 60s timeout. A separate real-provider acceptance is still required.
"""
import os
import sys
import time
from pathlib import Path

assert os.environ.get('DATABASE_PATH'), 'An isolated DATABASE_PATH is required'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from controllers import project_controller


class SlowModel:
    def generate_outline_stream(self, *_args, **_kwargs):
        time.sleep(70)
        yield {'title': '慢响应保活验收', 'points': ['等待超过 60 秒后正常生成']}
        yield {'__stream_complete__': True}


project_controller.get_ai_service = lambda: SlowModel()
app = create_app()
assert not app.config['PUBLIC_DEMO'], 'This fixture must not use public visitor data'
app.run(host='0.0.0.0', port=int(os.environ.get('BACKEND_PORT', '5496')), threaded=True, use_reloader=False)
