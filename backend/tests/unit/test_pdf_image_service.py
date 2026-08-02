"""Unit tests for backend/services/pdf_image_service.py."""
import io
from pathlib import Path

import fitz  # PyMuPDF
import pytest
from PIL import Image


def _make_pdf(path: Path, page_count: int = 3) -> None:
    """Build a small multi-page PDF on disk using PyMuPDF."""
    doc = fitz.open()
    for i in range(page_count):
        page = doc.new_page(width=595, height=842)  # A4 portrait
        page.insert_text((50, 80), f"Page {i + 1}", fontsize=24)
    doc.save(str(path))
    doc.close()


def test_pdf_to_page_images_renders_each_page(tmp_path):
    from services.pdf_image_service import pdf_to_page_images
    pdf_path = tmp_path / 'sample.pdf'
    _make_pdf(pdf_path, page_count=3)

    output_dir = tmp_path / 'pages'
    results = pdf_to_page_images(str(pdf_path), str(output_dir), dpi=120)

    assert len(results) == 3
    for i, r in enumerate(results, start=1):
        assert r['index'] == i
        assert r['path'] is not None
        out = Path(r['path'])
        assert out.exists()
        with Image.open(out) as img:
            assert img.format == 'PNG'
            assert img.width > 0


def test_pdf_to_page_images_rejects_too_many_pages(tmp_path):
    from services.pdf_image_service import pdf_to_page_images
    pdf_path = tmp_path / 'big.pdf'
    _make_pdf(pdf_path, page_count=4)

    with pytest.raises(ValueError, match='too long'):
        pdf_to_page_images(str(pdf_path), str(tmp_path / 'out'), max_pages=3)


def test_count_pdf_pages(tmp_path):
    from services.pdf_image_service import count_pdf_pages
    pdf_path = tmp_path / 'count.pdf'
    _make_pdf(pdf_path, page_count=5)
    assert count_pdf_pages(str(pdf_path)) == 5


def test_count_pdf_pages_returns_none_for_invalid(tmp_path):
    from services.pdf_image_service import count_pdf_pages
    junk = tmp_path / 'junk.pdf'
    junk.write_bytes(b'this is not a pdf')
    assert count_pdf_pages(str(junk)) is None
