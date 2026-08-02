"""
Unit tests for FileParserService provider-specific behavior.
"""

import os
import io
import builtins
import tempfile
import uuid
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.file_parser_service import FileParserService, _resolve_upload_folder


def _create_temp_image() -> str:
    with tempfile.NamedTemporaryFile(prefix='caption_test_', suffix='.png', delete=False) as tmp:
        Image.new('RGB', (20, 20), color='green').save(tmp.name)
        return tmp.name


def test_generate_single_caption_uses_provider_factory():
    """Caption generation should delegate to the provider factory's generate_with_image."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gpt-4.1-mini',
            provider_format='openai',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '示例描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '示例描述'
        mock_provider.generate_with_image.assert_called_once()
        call_args = mock_provider.generate_with_image.call_args
        assert '描述' in call_args[0][0]
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def test_can_generate_captions_returns_false_when_factory_fails():
    """_can_generate_captions should return False when the provider factory raises."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='lazyllm',
    )
    with patch(
        'services.file_parser_service.FileParserService._get_caption_provider',
        side_effect=ValueError("no key"),
    ):
        assert service._can_generate_captions() is False


def test_can_generate_captions_returns_true_when_factory_succeeds():
    """_can_generate_captions should return True when the provider factory returns a provider."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='openai',
    )
    mock_provider = MagicMock()
    with patch.object(service, '_get_caption_provider', return_value=mock_provider):
        assert service._can_generate_captions() is True


def test_generate_single_caption_vertex_uses_provider_factory():
    """Vertex provider should also go through the factory (the original bug)."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gemini-2.0-flash',
            provider_format='vertex',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '顶点描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '顶点描述'
        mock_provider.generate_with_image.assert_called_once()
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def _build_mineru_zip() -> bytes:
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as archive:
        archive.writestr('full.md', 'hello\n')
        archive.writestr('images/chart.png', b'fake image')
    return zip_buffer.getvalue()


def test_download_markdown_uses_flask_upload_folder_for_mineru_results(app, tmp_path, monkeypatch):
    """Desktop UPLOAD_FOLDER overrides must be where MinerU extracted artifacts are persisted."""
    desktop_uploads = tmp_path / 'banana-slides-desktop' / 'uploads'

    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(desktop_uploads))
        service = FileParserService(mineru_token='test-token')

        mock_response = MagicMock()
        mock_response.content = _build_mineru_zip()
        mock_response.raise_for_status.return_value = None

        with patch('requests.get', return_value=mock_response):
            with patch('uuid.uuid4', return_value=uuid.UUID('f58159a1-0000-0000-0000-000000000000')):
                markdown, extract_id, error = service._download_markdown('https://example.test/result.zip')

    assert error is None
    assert extract_id == 'f58159a1'
    assert markdown == 'hello\n'
    assert (desktop_uploads / 'mineru_files' / 'f58159a1' / 'full.md').is_file()
    assert (desktop_uploads / 'mineru_files' / 'f58159a1' / 'images' / 'chart.png').is_file()


def test_download_markdown_resolves_flask_upload_folder_at_runtime(app, tmp_path, monkeypatch):
    """A parser constructed before app context should still honor desktop runtime config."""
    service = FileParserService(mineru_token='test-token')
    desktop_uploads = tmp_path / 'late-configured-desktop' / 'uploads'

    mock_response = MagicMock()
    mock_response.content = _build_mineru_zip()
    mock_response.raise_for_status.return_value = None

    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(desktop_uploads))
        with patch('requests.get', return_value=mock_response):
            with patch('uuid.uuid4', return_value=uuid.UUID('ab2d6b8b-0000-0000-0000-000000000000')):
                _markdown, extract_id, error = service._download_markdown('https://example.test/result.zip')

    assert error is None
    assert extract_id == 'ab2d6b8b'
    assert (desktop_uploads / 'mineru_files' / 'ab2d6b8b' / 'full.md').is_file()


def test_extract_header_footer_reads_layout_from_flask_upload_folder(app, tmp_path, monkeypatch):
    """Header/footer recovery must read the same MinerU result root used by desktop exports."""
    desktop_uploads = tmp_path / 'banana-slides-desktop' / 'uploads'
    mineru_dir = desktop_uploads / 'mineru_files' / 'ab2d6b8b'
    mineru_dir.mkdir(parents=True)
    (mineru_dir / 'layout.json').write_text(
        '''{
          "pdf_info": [{
            "discarded_blocks": [
              {"type": "header", "lines": [{"spans": [{"type": "text", "content": "页眉"}]}]},
              {"type": "footer", "lines": [{"spans": [{"type": "text", "content": "页脚"}]}]},
              {"type": "footer", "lines": [{"spans": [{"type": "text", "content": "#"}]}]}
            ]
          }]
        }''',
        encoding='utf-8',
    )

    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(desktop_uploads))

        text = FileParserService.extract_header_footer_from_layout('ab2d6b8b')

    assert text == '页眉\n页脚'


def test_extract_header_footer_returns_empty_for_missing_extract_id(app):
    with app.app_context():
        assert FileParserService.extract_header_footer_from_layout(None) == ''
        assert FileParserService.extract_header_footer_from_layout('') == ''


def test_relative_upload_folder_cannot_escape_project_root():
    """Relative upload roots are project-local only; desktop absolute paths remain supported separately."""
    with pytest.raises(ValueError, match='project root'):
        FileParserService(mineru_token='test-token', upload_folder='../outside-uploads')


def test_resolve_upload_folder_uses_env_when_flask_import_is_unavailable(tmp_path, monkeypatch):
    env_uploads = tmp_path / 'env-uploads'
    monkeypatch.setenv('UPLOAD_FOLDER', str(env_uploads))
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == 'flask':
            raise ImportError('flask unavailable')
        return real_import(name, *args, **kwargs)

    with patch('builtins.__import__', side_effect=fake_import):
        assert _resolve_upload_folder() == env_uploads.resolve()


def test_resolve_upload_folder_ignores_invalid_flask_config(app, tmp_path, monkeypatch):
    env_uploads = tmp_path / 'env-uploads'
    monkeypatch.setenv('UPLOAD_FOLDER', str(env_uploads))

    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', object())

        assert _resolve_upload_folder() == env_uploads.resolve()


def test_extract_header_footer_rejects_extract_id_traversal(app, tmp_path, monkeypatch):
    desktop_uploads = tmp_path / 'banana-slides-desktop' / 'uploads'
    outside_dir = desktop_uploads / 'outside'
    outside_dir.mkdir(parents=True)
    (outside_dir / 'layout.json').write_text(
        '{"pdf_info": [{"discarded_blocks": [{"type": "header", "lines": [{"spans": [{"type": "text", "content": "secret"}]}]}]}]}',
        encoding='utf-8',
    )

    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(desktop_uploads))

        text = FileParserService.extract_header_footer_from_layout('../outside')

    assert text == ''
