"""Regression coverage for issues #590, #597 and #599."""
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider


def provider_with_content(content):
    with patch('services.ai_providers.image.openai_provider.OpenAI'):
        provider = OpenAIImageProvider(api_key='test', api_base='https://relay.example/v1', model='relay-image', image_api_protocol='chat')
    provider.client = MagicMock()
    provider.client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
    return provider


@pytest.mark.parametrize('url', [
    'https://storage.example/image?X-Amz-Signature=test',
    'https://storage.example/image.png?token=test',
    'https://storage.example/IMAGE.JPG',
])
def test_chat_image_downloads_url_once(url):
    buf = BytesIO()
    Image.new('RGB', (7, 9), 'blue').save(buf, 'PNG')
    response = MagicMock(content=buf.getvalue())
    with patch('services.ai_providers.image.openai_provider.requests.get', return_value=response) as download:
        result = provider_with_content('  ' + url + '\n').generate_image('test')
    assert result.size == (7, 9)
    assert result.getpixel((0, 0)) == (0, 0, 255)
    assert download.call_count == 1
    assert download.call_args.args[0] == url


@pytest.mark.parametrize('content', [
    'https://storage.example/image.png',
    'https://storage.example/image?token=test',
    '![image](https://storage.example/image.png)',
])
@pytest.mark.parametrize('failure', ['http', 'invalid-image'])
def test_failed_download_is_not_repeated(content, failure):
    response = MagicMock(content=b'not an image')
    if failure == 'http':
        response.raise_for_status.side_effect = RuntimeError('upstream error')
    with patch('services.ai_providers.image.openai_provider.requests.get', return_value=response) as download:
        with pytest.raises(Exception, match='No valid multimodal response'):
            provider_with_content(content).generate_image('test')
    assert download.call_count == 1


@pytest.mark.parametrize('content', ['some explanation https://storage.example/image', 'https://storage.example/a https://storage.example/b'])
def test_bare_url_fallback_does_not_download_prose(content):
    with patch('services.ai_providers.image.openai_provider.requests.get') as download:
        with pytest.raises(Exception, match='No valid multimodal response'):
            provider_with_content(content).generate_image('test')
    download.assert_not_called()


@pytest.mark.parametrize('protocol', ['auto', 'images', 'chat'])
def test_saved_image_protocol_is_loaded_after_restart(client, protocol):
    from app import create_app
    from models import Settings, db
    from services.ai_providers import get_image_provider
    settings = Settings.get_settings()
    settings.openai_image_api_protocol = protocol
    settings.ai_provider_format = 'openai'
    settings.image_model = 'custom-image'
    settings.api_key = 'test-key'
    db.session.commit()
    restarted = create_app()
    with restarted.app_context():
        assert restarted.config['OPENAI_IMAGE_API_PROTOCOL'] == protocol
        assert get_image_provider().image_api_protocol == protocol


def test_mineru_traversal_and_symlink_never_reach_image_provider(monkeypatch, tmp_path):
    from config import get_config
    from services.ai_service import AIService
    upload = tmp_path / 'uploads'
    valid = upload / 'mineru_files' / 'extract' / 'valid.png'
    valid.parent.mkdir(parents=True)
    Image.new('RGB', (4, 4), 'blue').save(valid)
    secret = tmp_path / 'uploads_secret' / 'flag.png'
    secret.parent.mkdir()
    Image.new('RGB', (4, 4), 'red').save(secret)
    (valid.parent / 'linked.png').symlink_to(secret)
    monkeypatch.setattr(get_config(), 'UPLOAD_FOLDER', str(upload))
    monkeypatch.setenv('UPLOAD_FOLDER', str(upload))
    provider = MagicMock()
    received_pixels = []
    def capture(**kwargs):
        received_pixels.extend(image.getpixel((0, 0)) for image in kwargs['ref_images'])
        return Image.new('RGB', (4, 4))
    provider.generate_image.side_effect = capture
    AIService(text_provider=object(), image_provider=provider, caption_provider=object()).generate_image(
        'test', additional_ref_images=[
            '/files/mineru/../../uploads_secret/flag.png',
            '/files/mineru/extract/linked.png',
            '/files/mineru/extract/valid.png',
        ])
    refs = provider.generate_image.call_args.kwargs['ref_images']
    assert len(refs) == 1
    assert received_pixels == [(0, 0, 255)]
