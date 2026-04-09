"""Reference file commands."""

from __future__ import annotations

from typing import Optional

import typer

from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("upload")
@cli_command
def refs_upload(
    file: str = typer.Option(..., help="Absolute file path"),
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
) -> None:
    """Upload reference file."""
    path = ensure_file(file)
    form: dict = {}
    if project_id:
        form["project_id"] = resolve_project_id(project_id, allow_context=False)
    with path.open("rb") as f:
        emit_output(state.api.post("/api/reference-files/upload", form_data=form, files={"file": (path.name, f)}))


@app.command("list")
@cli_command
def refs_list(
    project_id: str = typer.Option("all", help="Project ID, prefix, or 'all'"),
) -> None:
    """List reference files."""
    if project_id != "all":
        project_id = resolve_project_id(project_id, allow_context=False)
    emit_output(state.api.get(f"/api/reference-files/project/{project_id}"))


@app.command("get")
@cli_command
def refs_get(
    file_id: str = typer.Option(..., help="File ID"),
) -> None:
    """Get single reference file."""
    emit_output(state.api.get(f"/api/reference-files/{file_id}"))


@app.command("parse")
@cli_command
def refs_parse(
    file_id: str = typer.Option(..., help="File ID"),
) -> None:
    """Trigger parsing."""
    emit_output(state.api.post(f"/api/reference-files/{file_id}/parse"))


@app.command("associate")
@cli_command
def refs_associate(
    file_id: str = typer.Option(..., help="File ID"),
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
) -> None:
    """Associate file to project."""
    project_id = resolve_project_id(project_id)
    emit_output(state.api.post(f"/api/reference-files/{file_id}/associate", json_data={"project_id": project_id}))


@app.command("dissociate")
@cli_command
def refs_dissociate(
    file_id: str = typer.Option(..., help="File ID"),
) -> None:
    """Dissociate file from project."""
    emit_output(state.api.post(f"/api/reference-files/{file_id}/dissociate"))


@app.command("delete")
@cli_command
def refs_delete(
    file_id: str = typer.Option(..., help="File ID"),
) -> None:
    """Delete reference file."""
    emit_output(state.api.delete(f"/api/reference-files/{file_id}"))
