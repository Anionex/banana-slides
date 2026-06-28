"""
Material upload API tests - including caption generation
"""
import io
import pytest
import re
from unittest.mock import patch, MagicMock
from PIL import Image
from conftest import assert_success_response, assert_error_response


def _create_test_image():
    """Helper to create a test PNG image bytes"""
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes


@pytest.mark.unit
class TestMaterialUpload:
    """Material upload endpoint tests"""

    def test_upload_material_without_caption(self, client):
        """Upload without generate_caption param should not include caption in response"""
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload',
            data={'file': (img_bytes, 'test.png')},
            content_type='multipart/form-data'
        )
        data = assert_success_response(response, 201)
        assert 'url' in data['data']
        assert data['data']['caption'] is None

    @patch('controllers.material_controller._generate_image_caption')
    def test_upload_material_with_caption(self, mock_caption, client):
        """Upload with generate_caption=true should include AI caption"""
        mock_caption.return_value = '一张红色方块图片'
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload?generate_caption=true',
            data={'file': (img_bytes, 'test.png')},
            content_type='multipart/form-data'
        )
        data = assert_success_response(response, 201)
        assert data['data']['caption'] == '一张红色方块图片'
        assert 'url' in data['data']
        mock_caption.assert_called_once()

    @patch('controllers.material_controller._generate_image_caption')
    def test_upload_material_caption_failure_still_succeeds(self, mock_caption, client):
        """Caption failure should return empty string, upload still succeeds"""
        mock_caption.return_value = ''
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload?generate_caption=true',
            data={'file': (img_bytes, 'test.png')},
            content_type='multipart/form-data'
        )
        data = assert_success_response(response, 201)
        assert data['data']['caption'] == ''
        assert 'url' in data['data']

    @patch('controllers.material_controller._generate_image_caption')
    def test_upload_material_caption_false_param(self, mock_caption, client):
        """generate_caption=false should not trigger caption generation"""
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload?generate_caption=false',
            data={'file': (img_bytes, 'test.png')},
            content_type='multipart/form-data'
        )
        data = assert_success_response(response, 201)
        assert data['data']['caption'] is None
        mock_caption.assert_not_called()

    def test_upload_material_invalid_file_type(self, client):
        """Unsupported file type should return 400"""
        response = client.post(
            '/api/materials/upload',
            data={'file': (io.BytesIO(b'fake data'), 'test.txt')},
            content_type='multipart/form-data'
        )
        assert response.status_code == 400

    def test_upload_material_chinese_filename_uses_content_type_and_uuid_storage(self, client):
        """Chinese filenames should upload successfully and not drive storage names."""
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload',
            data={'file': (img_bytes, '正文.png')},
            content_type='multipart/form-data'
        )

        data = assert_success_response(response, 201)
        material = data['data']
        assert material['original_filename'] == '正文.png'
        assert re.fullmatch(r'[0-9a-f]{32}\.png', material['filename'])
        assert material['relative_path'] == f"materials/{material['filename']}"
        assert material['url'] == f"/files/materials/{material['filename']}"

    def test_upload_material_spoofed_extension_still_uses_detected_image_format(self, client):
        """Storage extension should come from image bytes, not the client filename."""
        img_bytes = _create_test_image()
        response = client.post(
            '/api/materials/upload',
            data={'file': (img_bytes, 'not-really-a-bmp.bmp')},
            content_type='multipart/form-data'
        )

        data = assert_success_response(response, 201)
        material = data['data']
        assert material['original_filename'] == 'not-really-a-bmp.bmp'
        assert material['filename'].endswith('.png')

    def test_upload_material_svg_detection_does_not_parse_entities(self, client):
        """SVG detection should not expand or parse XML entities."""
        svg_bytes = io.BytesIO(b'''<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY a "entity expansion should not be parsed">
]>
<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>
''')

        response = client.post(
            '/api/materials/upload',
            data={'file': (svg_bytes, '图标.svg')},
            content_type='multipart/form-data'
        )

        data = assert_success_response(response, 201)
        material = data['data']
        assert material['original_filename'] == '图标.svg'
        assert material['filename'].endswith('.svg')

    def test_upload_material_text_mentioning_svg_is_rejected(self, client):
        """Arbitrary text containing '<svg' should not be treated as SVG."""
        response = client.post(
            '/api/materials/upload',
            data={'file': (io.BytesIO(b'This text mentions <svg but is not an SVG document.'), 'notes.svg')},
            content_type='multipart/form-data'
        )

        assert response.status_code == 400

    @patch('controllers.material_controller.Image.open')
    def test_upload_material_corrupted_image_errors_are_rejected(self, mock_image_open, client):
        """Unexpected Pillow parser errors should return 400 instead of 500."""
        mock_image_open.side_effect = IndexError('truncated image data')

        response = client.post(
            '/api/materials/upload',
            data={'file': (io.BytesIO(b'corrupted image bytes'), 'broken.png')},
            content_type='multipart/form-data'
        )

        assert response.status_code == 400

    def test_upload_material_no_file(self, client):
        """No file should return 400"""
        response = client.post(
            '/api/materials/upload',
            content_type='multipart/form-data'
        )
        assert response.status_code == 400


@pytest.mark.unit
class TestGenerateImageCaption:
    """Unit tests for _generate_image_caption function"""

    def test_caption_returns_empty_on_missing_gemini_key(self, app):
        """Caption returns empty when Gemini API key is not configured"""
        with app.app_context():
            app.config['AI_PROVIDER_FORMAT'] = 'gemini'
            app.config['GOOGLE_API_KEY'] = ''
            from controllers.material_controller import _generate_image_caption
            # Create a temp image
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
                img = Image.new('RGB', (10, 10), color='blue')
                img.save(f, format='PNG')
                tmp_path = f.name
            try:
                result = _generate_image_caption(tmp_path)
                assert result == ''
            finally:
                import os
                os.unlink(tmp_path)

    def test_caption_returns_empty_on_missing_openai_key(self, app):
        """Caption returns empty when OpenAI API key is not configured"""
        with app.app_context():
            app.config['AI_PROVIDER_FORMAT'] = 'openai'
            app.config['OPENAI_API_KEY'] = ''
            from controllers.material_controller import _generate_image_caption
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
                img = Image.new('RGB', (10, 10), color='blue')
                img.save(f, format='PNG')
                tmp_path = f.name
            try:
                result = _generate_image_caption(tmp_path)
                assert result == ''
            finally:
                import os
                os.unlink(tmp_path)

    def test_caption_returns_empty_on_invalid_file(self, app):
        """Caption returns empty on invalid image file"""
        with app.app_context():
            app.config['AI_PROVIDER_FORMAT'] = 'gemini'
            app.config['GOOGLE_API_KEY'] = 'fake-key'
            from controllers.material_controller import _generate_image_caption
            result = _generate_image_caption('/nonexistent/path/image.png')
            assert result == ''

    @patch('google.genai.Client')
    def test_caption_gemini_success(self, mock_client_class, app):
        """Caption with Gemini provider returns expected text"""
        with app.app_context():
            app.config['AI_PROVIDER_FORMAT'] = 'gemini'
            app.config['GOOGLE_API_KEY'] = 'test-key'
            app.config['GOOGLE_API_BASE'] = ''
            app.config['IMAGE_CAPTION_MODEL'] = 'test-model'

            mock_client = MagicMock()
            mock_client_class.return_value = mock_client
            mock_result = MagicMock()
            mock_result.text = '  一张测试图片  '
            mock_client.models.generate_content.return_value = mock_result

            from controllers.material_controller import _generate_image_caption
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
                img = Image.new('RGB', (10, 10), color='green')
                img.save(f, format='PNG')
                tmp_path = f.name
            try:
                result = _generate_image_caption(tmp_path)
                assert result == '一张测试图片'
                mock_client.models.generate_content.assert_called_once()
            finally:
                import os
                os.unlink(tmp_path)
