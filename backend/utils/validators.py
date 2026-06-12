"""
Data validation utilities
"""
import re
from math import gcd
from typing import Set
from urllib.parse import urlparse

# --- Aspect ratio validation ---

_ASPECT_RATIO_PATTERN = re.compile(r"^\d+:\d+$")
_ASPECT_RATIO_MIN = 0.2
_ASPECT_RATIO_MAX = 5.0


def normalize_aspect_ratio(raw_value) -> str:
    """
    Normalize and validate aspect ratio input.

    - Accepts "W:H" where W/H are positive integers.
    - Reduces by gcd (e.g., "1920:1080" -> "16:9").
    - Rejects obviously invalid or extreme ratios.
    - Returns the normalized string like "16:9".
    """
    if raw_value is None:
        raise ValueError("Image aspect ratio is required")

    value = str(raw_value).strip()
    if value == "":
        raise ValueError("Image aspect ratio is required")

    if not _ASPECT_RATIO_PATTERN.fullmatch(value):
        raise ValueError(
            "Image aspect ratio must match \\d+:\\d+ (e.g., 16:9, 4:3, 1:1)"
        )

    width, height = (int(part) for part in value.split(":", 1))
    if width <= 0 or height <= 0:
        raise ValueError("Image aspect ratio must be positive integers (e.g., 16:9)")

    divisor = gcd(width, height)
    width //= divisor
    height //= divisor

    ratio_value = width / height
    if ratio_value < _ASPECT_RATIO_MIN or ratio_value > _ASPECT_RATIO_MAX:
        raise ValueError(
            f"Image aspect ratio must be between {_ASPECT_RATIO_MIN:.1f} and {_ASPECT_RATIO_MAX:.1f} (e.g., 16:9)"
        )

    normalized = f"{width}:{height}"
    if len(normalized) > 10:
        raise ValueError("Image aspect ratio is too long")

    return normalized


def parse_worker_count(raw_value, *, default: int, maximum: int, name: str = "max_workers") -> int:
    """Parse and clamp a worker count from API/config input."""
    value = default if raw_value is None else raw_value
    try:
        workers = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer")

    if workers < 1 or workers > maximum:
        raise ValueError(f"{name} must be between 1 and {maximum}")

    return workers


def validate_api_base_url(raw_value) -> str | None:
    """Validate API base URL settings and normalize empty strings to None."""
    if raw_value is None:
        return None

    value = str(raw_value).strip().rstrip("/")
    if value == "":
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        raise ValueError("API base URL must be a valid http(s) URL")

    hostname = (parsed.hostname or "").lower()
    if parsed.scheme == "http" and hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("API base URL must use https unless it points to localhost")

    if parsed.username or parsed.password:
        raise ValueError("API base URL must not include credentials")

    return value

# Project status states
PROJECT_STATUSES = {
    'DRAFT', 
    'OUTLINE_GENERATED', 
    'DESCRIPTIONS_GENERATED', 
    'GENERATING_IMAGES', 
    'COMPLETED'
}

# Page status states
PAGE_STATUSES = {
    'DRAFT', 
    'DESCRIPTION_GENERATED', 
    'GENERATING', 
    'COMPLETED', 
    'FAILED'
}

# Task status states
TASK_STATUSES = {
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
}

# Task types
TASK_TYPES = {
    'GENERATE_DESCRIPTIONS',
    'GENERATE_IMAGES',
    'EXPORT_EDITABLE_PPTX'
}


def validate_project_status(status: str) -> bool:
    """Validate project status"""
    return status in PROJECT_STATUSES


def validate_page_status(status: str) -> bool:
    """Validate page status"""
    return status in PAGE_STATUSES


def validate_task_status(status: str) -> bool:
    """Validate task status"""
    return status in TASK_STATUSES


def validate_task_type(task_type: str) -> bool:
    """Validate task type"""
    return task_type in TASK_TYPES


def allowed_file(filename: str, allowed_extensions: Set[str]) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

