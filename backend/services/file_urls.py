"""Helpers for generating public file URLs across local and cloud storage backends."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .storage import get_storage


def public_url(relative_path: Optional[str]) -> Optional[str]:
    """Return a frontend-safe public URL for a stored relative path."""
    if not relative_path:
        return None
    return get_storage().get_public_url(relative_path)


def project_file_url(project_id: Optional[str], file_type: str, path_or_filename: Optional[str]) -> Optional[str]:
    """Build a public URL for a project-bound file."""
    if not project_id or not path_or_filename:
        return None
    filename = Path(path_or_filename).name
    relative_path = f"{project_id}/{file_type}/{filename}"
    return public_url(relative_path)


def user_template_file_url(template_id: Optional[str], path_or_filename: Optional[str]) -> Optional[str]:
    """Build a public URL for a user template file."""
    if not template_id or not path_or_filename:
        return None
    filename = Path(path_or_filename).name
    relative_path = f"user-templates/{template_id}/{filename}"
    return public_url(relative_path)


def material_file_url(path_or_filename: Optional[str]) -> Optional[str]:
    """Build a public URL for a global material file."""
    if not path_or_filename:
        return None
    filename = Path(path_or_filename).name
    relative_path = f"materials/{filename}"
    return public_url(relative_path)
