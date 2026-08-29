"""Real MinerU authentication regression for PPT renovation."""

import uuid

import pytest

from services.file_parser_service import FileParserService


@pytest.mark.integration
def test_mineru_invalid_token_preserves_auth_failure_details(tmp_path):
    """The official MinerU API must expose an auth rejection before upload."""
    pdf_path = tmp_path / "issue-420-invalid-token.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
    service = FileParserService(
        mineru_token=f"banana-slides-invalid-{uuid.uuid4().hex}",
        mineru_api_base="https://mineru.net",
    )

    batch_id, markdown, extract_id, error_message, failed_images = service.parse_file(
        str(pdf_path),
        pdf_path.name,
    )

    assert batch_id is None
    assert markdown is None
    assert extract_id is None
    assert failed_images == 0
    assert error_message is not None
    normalized = error_message.lower()
    assert any(
        marker in normalized
        for marker in ("401", "403", "authenticate failed", "unauthorized", "forbidden")
    ), error_message
