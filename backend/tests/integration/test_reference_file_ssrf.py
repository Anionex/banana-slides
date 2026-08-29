"""Integration coverage for reference-file Markdown image fetching."""

import io
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import MagicMock, patch

from PIL import Image


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new('RGB', (2, 2), color='red').save(buffer, format='PNG')
    return buffer.getvalue()


def test_reference_markdown_parse_does_not_fetch_remote_images(client):
    """The real upload/parse API flow must never request a Markdown image URL."""
    payload = _png_bytes()
    requests_received = []

    class CanaryHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests_received.append(self.path)
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, _format, *_args):
            return

    server = HTTPServer(('127.0.0.1', 0), CanaryHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    provider = MagicMock()
    provider.generate_with_image.return_value = '远程图片'
    remote_url = f'http://127.0.0.1:{server.server_port}/metadata'
    markdown = f'# Report\n\n![]({remote_url})\n'

    try:
        with patch(
            'services.file_parser_service.FileParserService._get_caption_provider',
            return_value=provider,
        ):
            upload_response = client.post(
                '/api/reference-files/upload',
                data={'file': (io.BytesIO(markdown.encode('utf-8')), 'ssrf.md')},
                content_type='multipart/form-data',
            )
            assert upload_response.status_code == 200
            file_id = upload_response.get_json()['data']['file']['id']

            parse_response = client.post(f'/api/reference-files/{file_id}/parse')
            assert parse_response.status_code == 200

            deadline = time.monotonic() + 5
            parsed_file = None
            while time.monotonic() < deadline:
                status_response = client.get(f'/api/reference-files/{file_id}')
                assert status_response.status_code == 200
                parsed_file = status_response.get_json()['data']['file']
                if parsed_file['parse_status'] in {'completed', 'failed'}:
                    break
                time.sleep(0.05)

        assert parsed_file is not None
        assert parsed_file['parse_status'] == 'completed'
        assert parsed_file['markdown_content'] == markdown
        assert requests_received == []
        provider.generate_with_image.assert_not_called()
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)
