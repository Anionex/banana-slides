"""Task status commands."""

from __future__ import annotations

import typer

from ..jobs.workflow import wait_task
from ..output import cli_command, emit_output
from ..state import state

app = typer.Typer(no_args_is_help=True)


@app.command("status")
@cli_command
def tasks_status(
    project_id: str = typer.Option(..., help="Project ID"),
    task_id: str = typer.Option(..., help="Task ID"),
) -> None:
    """Get task status."""
    emit_output(state.api.get(f"/api/projects/{project_id}/tasks/{task_id}"))


@app.command("wait")
@cli_command
def tasks_wait(
    project_id: str = typer.Option(..., help="Project ID"),
    task_id: str = typer.Option(..., help="Task ID"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Wait for task completion."""
    result = wait_task(state.api, project_id, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)
    emit_output({"success": True, "data": result})
