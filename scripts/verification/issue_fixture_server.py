"""Isolated HTTP backend for issue regression tests; only AI providers are fixtures."""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from PIL import Image
from app import create_app
from models import db
from services.ai_service import AIService
import controllers.project_controller as projects
import controllers.material_controller as materials


class ImageFixture:
    def generate_image(self, prompt, **kwargs):
        time.sleep(8 if 'slow' in prompt else 1)
        if 'fail' in prompt:
            raise RuntimeError('Fixture generation failure')
        return Image.new('RGB', (160, 90), 'blue' if 'slow' in prompt else 'green')


service = AIService(text_provider=object(), image_provider=ImageFixture(), caption_provider=object())
def outline(context, **kwargs):
    yield {'title': 'Report overview', 'points': [context.idea_prompt]}
    yield {'__stream_complete__': True}
service.generate_outline_stream = outline
projects.get_ai_service = lambda: service
materials.get_ai_service = lambda: service
app = create_app()
with app.app_context():
    db.create_all()
app.run(host='127.0.0.1', port=int(os.environ['BACKEND_PORT']), threaded=True, use_reloader=False)
