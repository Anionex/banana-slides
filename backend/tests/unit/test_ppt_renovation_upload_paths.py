import io
from pathlib import Path
from unittest.mock import MagicMock, patch

from reportlab.pdfgen import canvas

from controllers.project_controller import _build_renovation_source_path
from services.task_manager import _resolve_renovation_pdf_path


def _make_sample_pdf() -> io.BytesIO:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(100, 750, "Hello renovation")
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer


def test_build_renovation_source_path_uses_stable_pdf_name(tmp_path):
    path = _build_renovation_source_path(tmp_path, "测试.pdf")

    assert path == tmp_path / "source.pdf"


def test_resolve_renovation_pdf_path_accepts_legacy_pdf_without_suffix(tmp_path):
    project_dir = tmp_path / "project"
    template_dir = project_dir / "template"
    template_dir.mkdir(parents=True)

    legacy_pdf = template_dir / "pdf"
    legacy_pdf.write_bytes(b"%PDF-1.4\n%legacy")

    assert _resolve_renovation_pdf_path(project_dir) == str(legacy_pdf)


def test_create_ppt_renovation_project_saves_pdf_with_stable_name(client, app):
    pdf_bytes = _make_sample_pdf()

    with patch("controllers.project_controller.task_manager.submit_task") as mock_submit:
        with patch("controllers.project_controller.get_ai_service", return_value=MagicMock()):
            with patch("services.file_parser_service.FileParserService", return_value=MagicMock()):
                response = client.post(
                    "/api/projects/renovation",
                    data={
                        "file": (pdf_bytes, "测试.pdf"),
                        "keep_layout": "false",
                    },
                    content_type="multipart/form-data",
                )

    assert response.status_code == 202
    payload = response.get_json()
    assert payload["success"] is True
    assert mock_submit.called

    project_id = payload["data"]["project_id"]
    saved_pdf = Path(app.config["UPLOAD_FOLDER"]) / project_id / "template" / "source.pdf"
    legacy_name = Path(app.config["UPLOAD_FOLDER"]) / project_id / "template" / "pdf"

    assert saved_pdf.exists()
    assert not legacy_name.exists()
