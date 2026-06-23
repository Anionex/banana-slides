"""PDF page-image rendering service for the per-page template feature.

Used by the SPLIT_TEMPLATE_PDF task to turn an uploaded PDF into one PNG per
page that the user can later import into the project template library.
"""
import logging
from pathlib import Path
from typing import List, Optional

import fitz  # PyMuPDF


logger = logging.getLogger(__name__)


def pdf_to_page_images(pdf_path: str, output_dir: str, dpi: int = 150,
                       max_pages: int = 50) -> List[dict]:
    """Render every page of *pdf_path* as a PNG inside *output_dir*.

    Returns a list of `{"index": <1-based>, "path": <abs str | None>, "error": <str?>}`.
    Failed pages keep their index so the caller can map results 1-to-1.
    """
    doc = fitz.open(pdf_path)
    try:
        if len(doc) == 0:
            raise ValueError("PDF has 0 pages")
        if len(doc) > max_pages:
            raise ValueError(f"PDF too long: {len(doc)} pages, max {max_pages}")

        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        results: List[dict] = []
        for i, page in enumerate(doc):
            page_no = i + 1
            out_path = out_dir / f"page_{page_no}.png"
            try:
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                pix.save(str(out_path))
                results.append({"index": page_no, "path": str(out_path)})
            except Exception as exc:
                logger.warning("PDF page %s render failed: %s", page_no, exc)
                results.append({"index": page_no, "path": None, "error": str(exc)})
        return results
    finally:
        doc.close()


def count_pdf_pages(pdf_path: str) -> Optional[int]:
    """Return the page count of *pdf_path*, or None if it cannot be opened."""
    try:
        doc = fitz.open(pdf_path)
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception as exc:
        logger.warning("Could not open PDF %s: %s", pdf_path, exc)
        return None
