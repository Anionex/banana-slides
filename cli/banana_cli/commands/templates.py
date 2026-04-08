"""Template commands."""

from __future__ import annotations

import typer

from ..output import cli_command, emit_output
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("upload")
@cli_command
def templates_upload(
    project_id: str = typer.Option(..., help="Project ID"),
    file: str = typer.Option(..., help="Absolute file path"),
) -> None:
    """Upload project template image."""
    path = ensure_file(file)
    with path.open("rb") as f:
        emit_output(state.api.post(f"/api/projects/{project_id}/template", files={"template_image": (path.name, f)}))


@app.command("delete")
@cli_command
def templates_delete(
    project_id: str = typer.Option(..., help="Project ID"),
) -> None:
    """Delete project template."""
    emit_output(state.api.delete(f"/api/projects/{project_id}/template"))
