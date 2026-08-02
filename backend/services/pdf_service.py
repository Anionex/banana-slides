"""
PDF Service - PDF splitting utilities using PyPDF2
"""
import logging
import os
from typing import List
from PyPDF2 import PdfReader, PdfWriter

logger = logging.getLogger(__name__)


def split_pdf_to_pages(pdf_path: str, output_dir: str) -> List[str]:
    """
    Split a multi-page PDF into individual single-page PDF files.

    Args:
        pdf_path: Path to the source PDF file
        output_dir: Directory to write individual page PDFs

    Returns:
        List of file paths for each single-page PDF, ordered by page number
    """
    os.makedirs(output_dir, exist_ok=True)

    reader = PdfReader(pdf_path)
    page_paths = []

    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)

        page_path = os.path.join(output_dir, f"page_{i + 1}.pdf")
        with open(page_path, "wb") as f:
            writer.write(f)

        page_paths.append(page_path)

    logger.info(f"Split PDF into {len(page_paths)} pages: {pdf_path}")
    return page_paths
