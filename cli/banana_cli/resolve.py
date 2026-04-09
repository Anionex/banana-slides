"""Short ID prefix matching and working project context."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .errors import InputError


def _context_path() -> Path:
    """Return the path to the CLI context file."""
    from .config import default_config_path
    return default_config_path().parent / "context.json"


def _read_context() -> dict:
    path = _context_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_context(data: dict) -> None:
    path = _context_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def set_working_project(project_id: str) -> None:
    """Set the current working project."""
    ctx = _read_context()
    ctx["project_id"] = project_id
    _write_context(ctx)


def get_working_project() -> Optional[str]:
    """Get the current working project ID."""
    return _read_context().get("project_id")


def clear_working_project() -> None:
    """Clear the current working project."""
    ctx = _read_context()
    ctx.pop("project_id", None)
    _write_context(ctx)


def _is_full_uuid(value: str) -> bool:
    """Check if the value looks like a full UUID."""
    return len(value) == 36 and value.count("-") == 4


def resolve_project_id(
    project_id: Optional[str],
    *,
    api: object | None = None,
    allow_context: bool = True,
) -> str:
    """Resolve a project ID from short prefix, full UUID, or working context.

    Resolution order:
    1. If project_id is a full UUID (36 chars), use as-is
    2. If project_id is a short prefix, fetch project list and match
    3. If project_id is None and allow_context, fall back to working project
    """
    if project_id is None and allow_context:
        project_id = get_working_project()
        if project_id is None:
            raise InputError(
                "No project ID provided and no working project set. "
                "Use 'projects use <id>' to set a working project, or pass --project-id."
            )

    if project_id is None:
        raise InputError("Project ID is required")

    if _is_full_uuid(project_id):
        return project_id

    # Short prefix matching
    if api is None:
        from .state import state
        api = state.api

    resp = api.get("/api/projects", params={"limit": 200, "offset": 0})
    projects = resp.get("data", {}).get("projects", [])

    matches = [p for p in projects if p.get("id", "").startswith(project_id)]

    if len(matches) == 0:
        raise InputError(f"No project found matching prefix '{project_id}'")
    if len(matches) > 1:
        lines = [f"  {p['id'][:12]}…  {p.get('idea_prompt', '')[:40]}" for p in matches[:5]]
        hint = "\n".join(lines)
        raise InputError(
            f"Ambiguous prefix '{project_id}' matches {len(matches)} projects. "
            f"Provide more characters:\n{hint}"
        )

    return matches[0]["id"]


def resolve_page_id(
    page_id: str,
    project_id: str,
    *,
    api: object | None = None,
) -> str:
    """Resolve a page ID from short prefix or full UUID."""
    if _is_full_uuid(page_id):
        return page_id

    if api is None:
        from .state import state
        api = state.api

    resp = api.get(f"/api/projects/{project_id}")
    pages = resp.get("data", {}).get("project", {}).get("pages", [])

    matches = [p for p in pages if p.get("id", "").startswith(page_id)]

    if len(matches) == 0:
        raise InputError(f"No page found matching prefix '{page_id}' in project {project_id[:8]}…")
    if len(matches) > 1:
        lines = [f"  {p['id'][:12]}…  {p.get('outline_content', {}).get('title', '')[:30]}" for p in matches[:5]]
        hint = "\n".join(lines)
        raise InputError(
            f"Ambiguous prefix '{page_id}' matches {len(matches)} pages. "
            f"Provide more characters:\n{hint}"
        )

    return matches[0]["id"]
