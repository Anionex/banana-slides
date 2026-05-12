"""Task status commands."""

from __future__ import annotations

from typing import Optional

import typer

from ..jobs.workflow import make_stderr_progress_cb, wait_task
from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state

app = typer.Typer(no_args_is_help=True)


@app.command("status")
@cli_command
def tasks_status(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    task_id: str = typer.Option(..., help="Task ID"),
) -> None:
    """Get task status."""
    project_id = resolve_project_id(project_id)
    emit_output(state.api.get(f"/api/projects/{project_id}/tasks/{task_id}"))


@app.command("wait")
@cli_command
def tasks_wait(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    task_id: str = typer.Option(..., help="Task ID"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Wait for task completion."""
    project_id = resolve_project_id(project_id)
    result = wait_task(
        state.api, project_id, task_id,
        timeout_sec=timeout_sec,
        poll_interval=state.config.poll_interval,
        progress_callback=make_stderr_progress_cb(),
    )
    emit_output({"success": True, "data": result})
