"""Projects commands."""

from __future__ import annotations

from typing import Optional

import typer

from ..output import cli_command, emit_output
from ..state import state
from .common import load_data

app = typer.Typer(no_args_is_help=True)


@app.command("list")
@cli_command
def projects_list(
    limit: int = typer.Option(50, help="Max results"),
    offset: int = typer.Option(0, help="Offset"),
) -> None:
    """List projects."""
    emit_output(state.api.get("/api/projects", params={"limit": limit, "offset": offset}))


@app.command("get")
@cli_command
def projects_get(
    project_id: str = typer.Argument(..., help="Project ID"),
) -> None:
    """Get project details."""
    emit_output(state.api.get(f"/api/projects/{project_id}"))


@app.command("create")
@cli_command
def projects_create(
    creation_type: Optional[str] = typer.Option(None, help="idea / outline / descriptions"),
    idea_prompt: Optional[str] = typer.Option(None, help="Idea prompt"),
    outline_text: Optional[str] = typer.Option(None, help="Outline text"),
    description_text: Optional[str] = typer.Option(None, help="Description text"),
    template_style: Optional[str] = typer.Option(None, help="Template style"),
    extra_requirements: Optional[str] = typer.Option(None, help="Extra requirements"),
    image_aspect_ratio: Optional[str] = typer.Option(None, help="Image aspect ratio"),
    data: Optional[str] = typer.Option(None, help="JSON string body"),
    data_file: Optional[str] = typer.Option(None, help="Path to JSON file body"),
) -> None:
    """Create a project."""
    payload = load_data(data, data_file)
    for key, val in [
        ("creation_type", creation_type),
        ("idea_prompt", idea_prompt),
        ("outline_text", outline_text),
        ("description_text", description_text),
        ("template_style", template_style),
        ("extra_requirements", extra_requirements),
        ("image_aspect_ratio", image_aspect_ratio),
    ]:
        if val is not None:
            payload.setdefault(key, val)
    emit_output(state.api.post("/api/projects", json_data=payload))


@app.command("update")
@cli_command
def projects_update(
    project_id: str = typer.Argument(..., help="Project ID"),
    idea_prompt: Optional[str] = typer.Option(None),
    outline_text: Optional[str] = typer.Option(None),
    description_text: Optional[str] = typer.Option(None),
    template_style: Optional[str] = typer.Option(None),
    extra_requirements: Optional[str] = typer.Option(None),
    image_aspect_ratio: Optional[str] = typer.Option(None),
    export_extractor_method: Optional[str] = typer.Option(None),
    export_inpaint_method: Optional[str] = typer.Option(None),
    data: Optional[str] = typer.Option(None, help="JSON string body"),
    data_file: Optional[str] = typer.Option(None, help="Path to JSON file body"),
) -> None:
    """Update a project."""
    payload = load_data(data, data_file)
    for key, val in [
        ("idea_prompt", idea_prompt),
        ("outline_text", outline_text),
        ("description_text", description_text),
        ("template_style", template_style),
        ("extra_requirements", extra_requirements),
        ("image_aspect_ratio", image_aspect_ratio),
        ("export_extractor_method", export_extractor_method),
        ("export_inpaint_method", export_inpaint_method),
    ]:
        if val is not None:
            payload.setdefault(key, val)
    emit_output(state.api.put(f"/api/projects/{project_id}", json_data=payload))


@app.command("delete")
@cli_command
def projects_delete(
    project_id: str = typer.Argument(..., help="Project ID"),
) -> None:
    """Delete a project."""
    emit_output(state.api.delete(f"/api/projects/{project_id}"))
