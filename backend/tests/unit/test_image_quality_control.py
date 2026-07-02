from PIL import Image
import pytest

from models import Settings, db
from services.ai_service import AIService
from services.task_manager import (
    IMAGE_QUALITY_CONTROL_MAX_ATTEMPTS,
    ImageQualityControlError,
    generate_image_until_quality_passes,
    get_image_quality_control_enabled,
)


class FakeReviewService:
    def __init__(self, reviews):
        self.reviews = list(reviews)
        self.calls = []

    def review_generated_slide_image(self, image_path, **kwargs):
        self.calls.append((image_path, kwargs))
        assert image_path.endswith('.png')
        return self.reviews.pop(0)


def _image(color='blue'):
    return Image.new('RGB', (160, 90), color=color)


def test_settings_api_persists_and_resets_image_quality_control(client):
    response = client.get('/api/settings')
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['enable_image_quality_control'] is False

    response = client.put('/api/settings', json={'enable_image_quality_control': True})
    data = response.get_json()
    assert response.status_code == 200
    assert data['data']['enable_image_quality_control'] is True

    with client.application.app_context():
        settings = Settings.get_settings()
        assert settings.enable_image_quality_control is True
        assert get_image_quality_control_enabled() is True

    response = client.post('/api/settings/reset')
    data = response.get_json()
    assert response.status_code == 200
    assert data['data']['enable_image_quality_control'] is False


def test_image_quality_control_retries_until_review_passes():
    ai_service = FakeReviewService([
        {'passed': False, 'issues': ['garbled text'], 'reason': 'Text is unreadable'},
        {'passed': True, 'issues': [], 'reason': 'Looks good'},
    ])
    generated = []

    def generate():
        generated.append(True)
        return _image()

    result = generate_image_until_quality_passes(
        generate,
        ai_service,
        'prompt',
        'description',
        page_data={'title': 'Demo', 'points': ['One']},
        page_index=1,
        quality_control_enabled=True,
    )

    assert result.size == (160, 90)
    assert len(generated) == 2
    assert len(ai_service.calls) == 2
    assert ai_service.calls[0][1]['page_index'] == 1


def test_image_quality_control_fails_without_returning_unreviewed_image():
    ai_service = FakeReviewService([
        {'passed': False, 'issues': ['bad style'], 'reason': 'Mismatch'},
        {'passed': False, 'issues': ['garbled text'], 'reason': 'Unreadable'},
        {'passed': False, 'issues': ['low quality'], 'reason': 'Artifacts'},
    ])
    generated = []

    def generate():
        generated.append(True)
        return _image('red')

    with pytest.raises(ImageQualityControlError, match='图片质量控制未通过'):
        generate_image_until_quality_passes(
            generate,
            ai_service,
            'prompt',
            'description',
            quality_control_enabled=True,
        )

    assert len(generated) == IMAGE_QUALITY_CONTROL_MAX_ATTEMPTS
    assert len(ai_service.calls) == IMAGE_QUALITY_CONTROL_MAX_ATTEMPTS


def test_image_quality_control_reports_latest_generation_error(monkeypatch):
    ai_service = FakeReviewService([
        {'passed': False, 'issues': ['bad style'], 'reason': 'Mismatch'},
    ])
    attempts = []

    def generate():
        attempts.append(True)
        if len(attempts) == 1:
            return _image('red')
        raise RuntimeError('provider timeout')

    with pytest.raises(ImageQualityControlError, match='provider timeout') as exc_info:
        generate_image_until_quality_passes(
            generate,
            ai_service,
            'prompt',
            'description',
            quality_control_enabled=True,
            max_attempts=2,
        )

    assert len(attempts) == 2
    assert len(ai_service.calls) == 1
    assert isinstance(exc_info.value.__cause__, RuntimeError)


def test_image_quality_control_disabled_keeps_current_single_attempt_behavior():
    ai_service = FakeReviewService([
        {'passed': False, 'issues': ['would fail'], 'reason': 'Rejected'},
    ])
    generated = []

    def generate():
        generated.append(True)
        return _image()

    result = generate_image_until_quality_passes(
        generate,
        ai_service,
        'prompt',
        'description',
        quality_control_enabled=False,
    )

    assert result.size == (160, 90)
    assert len(generated) == 1
    assert ai_service.calls == []


def test_quality_review_string_false_is_not_treated_as_pass(monkeypatch, tmp_path):
    image_path = tmp_path / 'slide.png'
    _image().save(image_path)
    service = AIService.__new__(AIService)

    monkeypatch.setattr(
        service,
        'generate_json_with_image',
        lambda *_args, **_kwargs: {
            'passed': 'false',
            'issues': ['garbled text'],
            'reason': 'Unreadable labels',
        },
    )

    result = service.review_generated_slide_image(
        str(image_path),
        generation_prompt='prompt',
        page_desc='description',
    )

    assert result['passed'] is False
    assert result['issues'] == ['garbled text']


def test_quality_review_accepts_list_wrapped_numeric_passed(monkeypatch, tmp_path):
    image_path = tmp_path / 'slide.png'
    _image().save(image_path)
    service = AIService.__new__(AIService)

    monkeypatch.setattr(
        service,
        'generate_json_with_image',
        lambda *_args, **_kwargs: [{
            'passed': 1,
            'issues': [],
            'reason': 'Looks good',
        }],
    )

    result = service.review_generated_slide_image(
        str(image_path),
        generation_prompt='prompt',
        page_desc='description',
    )

    assert result['passed'] is True
    assert result['reason'] == 'Looks good'


@pytest.fixture(autouse=True)
def clean_settings(client):
    yield
    with client.application.app_context():
        db.session.rollback()
