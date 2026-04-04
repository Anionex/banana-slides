import subprocess
from unittest.mock import patch

import pytest

from controllers.project_controller import (
    _convert_office_document_to_pdf,
    _resolve_libreoffice_binary,
)


class TestLibreOfficeBinaryResolution:
    def test_prefers_explicit_env_override(self, monkeypatch):
        monkeypatch.setenv('LIBREOFFICE_BIN', '/custom/bin/libreoffice')

        with patch('controllers.project_controller.shutil.which') as mock_which:
            mock_which.side_effect = lambda cmd: cmd if cmd == '/custom/bin/libreoffice' else None

            assert _resolve_libreoffice_binary() == '/custom/bin/libreoffice'

    def test_falls_back_to_soffice_when_libreoffice_is_missing(self, monkeypatch):
        monkeypatch.delenv('LIBREOFFICE_BIN', raising=False)

        with patch('controllers.project_controller.shutil.which') as mock_which:
            mock_which.side_effect = lambda cmd: '/usr/bin/soffice' if cmd == 'soffice' else None

            assert _resolve_libreoffice_binary() == 'soffice'


class TestOfficeDocumentConversion:
    def test_raises_clear_error_when_no_binary_is_available(self, tmp_path):
        original_path = tmp_path / 'sample.pptx'
        original_path.write_bytes(b'test')

        with patch('controllers.project_controller._resolve_libreoffice_binary', return_value=None):
            with pytest.raises(ValueError, match='requires LibreOffice'):
                _convert_office_document_to_pdf(original_path, tmp_path)

    def test_converts_with_resolved_binary(self, tmp_path):
        original_path = tmp_path / 'sample.pptx'
        original_path.write_bytes(b'test')
        expected_pdf = tmp_path / 'sample.pdf'

        def fake_run(command, check, timeout, capture_output, text):
            expected_pdf.write_bytes(b'%PDF-1.4\n')
            return subprocess.CompletedProcess(command, 0, stdout='ok', stderr='')

        with patch('controllers.project_controller._resolve_libreoffice_binary', return_value='soffice'):
            with patch('controllers.project_controller.subprocess.run', side_effect=fake_run) as mock_run:
                pdf_path = _convert_office_document_to_pdf(original_path, tmp_path)

        assert pdf_path == str(expected_pdf)
        assert mock_run.call_args[0][0][0] == 'soffice'
