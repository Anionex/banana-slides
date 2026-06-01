"""Docker Hub based application update checks."""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests

DOCKER_NAMESPACE = os.getenv("DOCKERHUB_NAMESPACE") or "anoinex"
DOCKER_REPOSITORY = os.getenv("DOCKERHUB_REPOSITORY") or "banana-slides"
DOCKER_HUB_TAGS_URL = "https://hub.docker.com/v2/repositories/{namespace}/{repository}/tags"


@dataclass
class TagInfo:
    name: str
    last_updated: str
    digests: set[str]


def _git_value(command: list[str]) -> str:
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        return subprocess.check_output(command, cwd=project_root, stderr=subprocess.DEVNULL, text=True, timeout=5).strip()
    except Exception:
        return ""


def get_current_version_metadata() -> dict[str, Any]:
    is_docker = os.getenv("IN_DOCKER", "0") == "1"
    full_sha = os.getenv("APP_COMMIT_SHA", "").strip()
    if not full_sha and not is_docker:
        full_sha = _git_value(["git", "rev-parse", "HEAD"])
    short_sha = os.getenv("APP_COMMIT_SHORT_SHA", "").strip() or (full_sha[:7] if full_sha else "")
    tag = os.getenv("APP_VERSION_TAG", "").strip()
    if not tag and not is_docker:
        tag = _git_value(["git", "describe", "--tags", "--exact-match", "HEAD"])
    build_date = os.getenv("APP_BUILD_DATE", "").strip()
    return {
        "tag": tag,
        "commit_sha": full_sha,
        "short_sha": short_sha,
        "build_date": build_date,
        "is_docker": is_docker,
    }


def _parse_tag(raw: dict[str, Any]) -> TagInfo | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("tag_status") and raw.get("tag_status") != "active":
        return None
    name = str(raw.get("name") or "")
    if not name or name == "buildcache":
        return None
    images = raw.get("images")
    digests = {
        str(image.get("digest"))
        for image in images
        if isinstance(image, dict) and image.get("digest")
    } if isinstance(images, list) else set()
    return TagInfo(name=name, last_updated=str(raw.get("last_updated") or ""), digests=digests)


def _parse_datetime(value: str) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        normalized = re.sub(r"(?<=:\d{2})\.\d+", "", value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _sha_from_tag(name: str) -> str:
    match = re.fullmatch(r"sha-([0-9a-fA-F]{7,40})", name)
    return match.group(1) if match else ""


def _shas_match(current_sha: str, latest_sha: str) -> bool:
    if not current_sha or not latest_sha:
        return False
    current_normalized = current_sha.lower()
    latest_normalized = latest_sha.lower()
    min_length = min(len(current_normalized), len(latest_normalized))
    return min_length >= 7 and current_normalized[:min_length] == latest_normalized[:min_length]


def _pick_latest(tags: list[TagInfo]) -> tuple[TagInfo | None, str]:
    latest = next((tag for tag in tags if tag.name == "latest"), None)
    sha_tags = [tag for tag in tags if _sha_from_tag(tag.name)]
    if not latest:
        newest_sha = max(sha_tags, key=lambda tag: _parse_datetime(tag.last_updated), default=None)
        return newest_sha, (_sha_from_tag(newest_sha.name) if newest_sha else "")

    same_digest_sha_tags = [
        tag for tag in sha_tags
        if latest.digests and tag.digests and latest.digests.intersection(tag.digests)
    ]
    newest_matching_sha = max(
        same_digest_sha_tags,
        key=lambda tag: _parse_datetime(tag.last_updated),
        default=None,
    )
    return latest, (_sha_from_tag(newest_matching_sha.name) if newest_matching_sha else "")


def fetch_docker_hub_tags(namespace: str = DOCKER_NAMESPACE, repository: str = DOCKER_REPOSITORY) -> list[TagInfo]:
    response = requests.get(
        DOCKER_HUB_TAGS_URL.format(namespace=namespace, repository=repository),
        params={"page_size": 25},
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    results = payload.get("results") if isinstance(payload, dict) else None
    return [
        parsed
        for raw in (results or [])
        if (parsed := _parse_tag(raw)) is not None
    ]


def check_for_update() -> dict[str, Any]:
    current = get_current_version_metadata()
    tags = fetch_docker_hub_tags()
    latest_tag, latest_sha = _pick_latest(tags)

    if not latest_tag:
        return {
            "status": "unknown",
            "update_available": False,
            "message": "No active Docker Hub tags found.",
            "current": current,
            "latest": None,
            "repository": f"{DOCKER_NAMESPACE}/{DOCKER_REPOSITORY}",
        }

    latest = {
        "tag": latest_tag.name,
        "sha": latest_sha,
        "last_updated": latest_tag.last_updated,
        "image": f"{DOCKER_NAMESPACE}/{DOCKER_REPOSITORY}:{latest_tag.name}",
    }

    min_date = datetime.min.replace(tzinfo=timezone.utc)
    latest_updated = _parse_datetime(latest_tag.last_updated)
    current_build_date = _parse_datetime(str(current.get("build_date") or ""))
    current_sha = str(current.get("short_sha") or "")

    if _shas_match(current_sha, latest_sha):
        status = "up_to_date"
        update_available = False
        message = "Current version is up to date."
    elif current_build_date > min_date and latest_updated > min_date and current_build_date >= latest_updated:
        status = "up_to_date"
        update_available = False
        message = "Current version is up to date."
    elif current_sha and latest_sha:
        status = "update_available"
        update_available = True
        message = "A newer version is available."
    elif not current["is_docker"]:
        status = "unknown"
        update_available = False
        message = "Unable to compare current source version with the latest version."
    elif current_build_date > min_date and latest_updated > min_date and (latest_updated - current_build_date).total_seconds() > 300:
        status = "update_available"
        update_available = True
        message = "Docker Hub latest was updated after the current image was built."
    elif current_build_date > min_date and latest_updated > min_date and (latest_updated - current_build_date).total_seconds() <= 300:
        status = "up_to_date"
        update_available = False
        message = "Current Docker image is up to date."
    else:
        status = "unknown"
        update_available = False
        message = "Unable to compare current image with Docker Hub latest."

    return {
        "status": status,
        "update_available": update_available,
        "message": message,
        "current": current,
        "latest": latest,
        "repository": f"{DOCKER_NAMESPACE}/{DOCKER_REPOSITORY}",
    }
