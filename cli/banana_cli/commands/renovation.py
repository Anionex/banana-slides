"""PPT renovation commands."""

from __future__ import annotations

from typing import Optional

import click
import typer

from ..jobs.workflow import wait_task
from ..output import cli_command, emit_output
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("create")
@cli_command
def renovation_create(
    file: str = typer.Option(..., help="Absolute file path (ppt/pdf)"),
    keep_layout: bool = typer.Option(False, help="Keep layout"),
    template_style: Optional[str] = typer.Option(None, help="Template style"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(["zh", "en", "ja", "auto"])),
    wait: bool = typer.Option(False, help="Wait for task completion"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Create renovation project from ppt/pdf."""
    path = ensure_file(file)
    form: dict = {"keep_layout": "true" if keep_layout else "false"}
    if template_style:
        form["template_style"] = template_style
    if language:
        form["language"] = language

    with path.open("rb") as f:
        resp = state.api.post("/api/projects/renovation", form_data=form, files={"file": (path.name, f)})

    if not wait:
        emit_output(resp)
        return

    project_id = resp.get("data", {}).get("project_id")
    task_id = resp.get("data", {}).get("task_id")
    if not project_id or not task_id:
        emit_output(resp)
        return

    final = wait_task(state.api, project_id, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)
    emit_output({"success": True, "data": {"project_id": project_id, "task_id": task_id, "task": final}})
