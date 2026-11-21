"""
Helpers for importing parsed reference-file images into the material library.
"""
import hashlib
import logging
import re
import shutil
from pathlib import Path
from posixpath import normpath
from typing import Optional
from urllib.parse import unquote

from PIL import Image

from models import Material, db
from services import FileService
from utils.path_utils import find_file_with_prefix

logger = logging.getLogger(__name__)

MARKDOWN_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)")
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


def import_reference_markdown_images_to_materials(
    *,
    project_id: Optional[str],
    markdown_content: Optional[str],
    upload_folder: str,
) -> int:
    """Copy local MinerU markdown images into the project's material library."""
    if not project_id or not markdown_content:
        return 0

    file_service = FileService(upload_folder)
    upload_root = Path(file_service.upload_folder)
    imported_count = 0
    existing_filenames = {
        filename
        for (filename,) in db.session.query(Material.filename).filter_by(project_id=project_id).all()
    }

    for alt_text, raw_image_url in _iter_markdown_images(markdown_content):
        try:
            image_url = unquote(raw_image_url).split("?", 1)[0].split("#", 1)[0]
            source_path = _resolve_local_mineru_image(image_url, upload_root)
            if source_path is None:
                continue

            file_ext = source_path.suffix.lower()
            if file_ext not in SUPPORTED_IMAGE_EXTENSIONS:
                logger.debug("Skipping unsupported parsed image type: %s", source_path)
                continue

            if not _is_valid_image_file(source_path):
                logger.warning("Skipping invalid parsed image: %s", source_path)
                continue

            deterministic_name = _material_filename_for_source(project_id, image_url, file_ext)
            if deterministic_name in existing_filenames:
                continue

            target_dir = file_service.get_materials_dir(project_id)
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / deterministic_name
            shutil.copy2(source_path, target_path)

            relative_path = target_path.relative_to(upload_root).as_posix()
            clean_alt = re.sub(r"<[^>]*>", "", alt_text.strip())
            clean_caption = clean_alt[:500] or None
            material = Material(
                project_id=project_id,
                filename=deterministic_name,
                relative_path=relative_path,
                url=file_service.get_file_url(project_id, "materials", deterministic_name),
                caption=clean_caption,
                original_filename=source_path.name,
            )
            db.session.add(material)
            existing_filenames.add(deterministic_name)
            imported_count += 1
        except Exception as exc:
            logger.error("导入解析后的图片失败: %s", exc, exc_info=True)
            continue

    return imported_count


def _iter_markdown_images(markdown_content: str):
    for match in MARKDOWN_IMAGE_RE.finditer(markdown_content):
        yield match.group(1), match.group(2).strip()


def _resolve_local_mineru_image(image_url: str, upload_folder: Path) -> Optional[Path]:
    image_url = image_url.split("?", 1)[0].split("#", 1)[0]
    if not image_url.startswith("/files/mineru/"):
        return None

    rel_path = image_url[len("/files/mineru/"):].lstrip("/\\")
    if not rel_path:
        return None

    normalized_rel_path = normpath(rel_path.replace("\\", "/"))
    if normalized_rel_path == "." or ".." in normalized_rel_path.split("/"):
        logger.warning("Path traversal attempt blocked for parsed image: %s", image_url)
        return None

    mineru_root = (upload_folder / "mineru_files").resolve()
    candidate = (mineru_root / normalized_rel_path).resolve()

    try:
        candidate.relative_to(mineru_root)
    except ValueError:
        logger.warning("Path traversal attempt blocked for parsed image: %s", image_url)
        return None

    if candidate.exists() and candidate.is_file():
        return candidate

    if not candidate.parent.exists() or not candidate.parent.is_dir():
        return None

    matched = find_file_with_prefix(candidate)
    if not matched:
        return None

    matched = matched.resolve()
    try:
        matched.relative_to(mineru_root)
    except ValueError:
        logger.warning("Path traversal attempt blocked for parsed image: %s", image_url)
        return None
    return matched


def _material_filename_for_source(project_id: str, image_url: str, file_ext: str) -> str:
    digest = hashlib.sha1(f"{project_id}:{image_url}".encode("utf-8")).hexdigest()[:24]
    return f"parsed_{digest}{file_ext}"


def _is_valid_image_file(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except Exception:
        return False
