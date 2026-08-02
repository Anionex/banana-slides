"""Page-level commands."""

from __future__ import annotations

import json
from typing import List, Optional

import click
import typer

from ..output import cli_command, emit_output
from ..resolve import resolve_page_id, resolve_project_id
from ..state import state
from .common import ensure_file, parse_list_csv

app = typer.Typer(no_args_is_help=True)

LANGUAGE_CHOICES = ["zh", "en", "ja", "auto"]


def _parse_json(raw: str) -> dict:
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("JSON payload must be an object")
    return parsed


@app.command("create")
@cli_command
def pages_create(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    order_index: int = typer.Option(..., help="Page order index"),
    part: Optional[str] = typer.Option(None, help="Page part"),
    outline_json: Optional[str] = typer.Option(None, help="Outline JSON"),
    description_json: Optional[str] = typer.Option(None, help="Description JSON"),
) -> None:
    """Create a page."""
    project_id = resolve_project_id(project_id)
    payload: dict = {"order_index": order_index}
    if part:
        payload["part"] = part
    if outline_json:
        payload["outline_content"] = _parse_json(outline_json)
    if description_json:
        payload["description_content"] = _parse_json(description_json)
    emit_output(state.api.post(f"/api/projects/{project_id}/pages", json_data=payload))


@app.command("update")
@cli_command
def pages_update(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    part: str = typer.Option(..., help="Page part"),
) -> None:
    """Update page base fields."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(state.api.put(f"/api/projects/{project_id}/pages/{page_id}", json_data={"part": part}))


@app.command("delete")
@cli_command
def pages_delete(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
) -> None:
    """Delete a page."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(state.api.delete(f"/api/projects/{project_id}/pages/{page_id}"))


@app.command("set-outline")
@cli_command
def pages_set_outline(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    outline_json: str = typer.Option(..., help="Outline JSON"),
) -> None:
    """Set page outline content."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(
        state.api.put(
            f"/api/projects/{project_id}/pages/{page_id}/outline",
            json_data={"outline_content": _parse_json(outline_json)},
        )
    )


@app.command("set-description")
@cli_command
def pages_set_description(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    description_json: str = typer.Option(..., help="Description JSON"),
) -> None:
    """Set page description content."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(
        state.api.put(
            f"/api/projects/{project_id}/pages/{page_id}/description",
            json_data={"description_content": _parse_json(description_json)},
        )
    )


@app.command("gen-description")
@cli_command
def pages_gen_description(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    force_regenerate: bool = typer.Option(False, help="Force regeneration"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(LANGUAGE_CHOICES)),
) -> None:
    """Generate single page description."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    payload: dict = {"force_regenerate": force_regenerate}
    if language:
        payload["language"] = language
    emit_output(
        state.api.post(f"/api/projects/{project_id}/pages/{page_id}/generate/description", json_data=payload)
    )


@app.command("gen-image")
@cli_command
def pages_gen_image(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    force_regenerate: bool = typer.Option(False, help="Force regeneration"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(LANGUAGE_CHOICES)),
    use_template: bool = typer.Option(True, "--use-template/--no-template", help="Use template"),
) -> None:
    """Generate single page image."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    payload: dict = {"force_regenerate": force_regenerate, "use_template": use_template}
    if language:
        payload["language"] = language
    emit_output(
        state.api.post(f"/api/projects/{project_id}/pages/{page_id}/generate/image", json_data=payload)
    )


@app.command("edit-image")
@cli_command
def pages_edit_image(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    instruction: str = typer.Option(..., help="Edit instruction"),
    use_template: bool = typer.Option(False, help="Use template"),
    desc_image_urls: Optional[str] = typer.Option(None, help="Comma-separated image urls"),
    context_image: Optional[List[str]] = typer.Option(None, help="Context image paths"),
) -> None:
    """Edit single page image."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    desc_urls = parse_list_csv(desc_image_urls)
    form_data = {
        "edit_instruction": instruction,
        "use_template": "true" if use_template else "false",
        "desc_image_urls": json.dumps(desc_urls),
    }

    files = []
    opened = []
    try:
        for path_str in (context_image or []):
            path = ensure_file(path_str)
            f = path.open("rb")
            opened.append(f)
            files.append(("context_images", (path.name, f)))

        emit_output(
            state.api.post(
                f"/api/projects/{project_id}/pages/{page_id}/edit/image",
                form_data=form_data,
                files=files,
            )
        )
    finally:
        for f in opened:
            f.close()


@app.command("versions")
@cli_command
def pages_versions(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
) -> None:
    """List page image versions."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(state.api.get(f"/api/projects/{project_id}/pages/{page_id}/image-versions"))


@app.command("set-current")
@cli_command
def pages_set_current(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    version_id: str = typer.Option(..., help="Version ID"),
) -> None:
    """Set current image version."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    emit_output(
        state.api.post(f"/api/projects/{project_id}/pages/{page_id}/image-versions/{version_id}/set-current")
    )


@app.command("regenerate-renovation")
@cli_command
def pages_regenerate_renovation(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    page_id: str = typer.Option(..., help="Page ID or prefix"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(LANGUAGE_CHOICES)),
    keep_layout: bool = typer.Option(False, help="Keep layout"),
) -> None:
    """Regenerate renovation page."""
    project_id = resolve_project_id(project_id)
    page_id = resolve_page_id(page_id, project_id)
    payload: dict = {"keep_layout": keep_layout}
    if language:
        payload["language"] = language
    emit_output(
        state.api.post(f"/api/projects/{project_id}/pages/{page_id}/regenerate-renovation", json_data=payload)
    )
