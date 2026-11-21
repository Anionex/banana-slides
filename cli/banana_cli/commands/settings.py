"""Settings commands."""

from __future__ import annotations

from typing import Optional

import typer

from ..output import cli_command, emit_output
from ..state import state
from .common import load_data

app = typer.Typer(no_args_is_help=True)

TEST_NAMES = ["baidu-ocr", "text-model", "caption-model", "baidu-inpaint", "image-model", "mineru-pdf"]


@app.command("get")
@cli_command
def settings_get() -> None:
    """Get settings."""
    emit_output(state.api.get("/api/settings/"))


@app.command("update")
@cli_command
def settings_update(
    data: Optional[str] = typer.Option(None, help="JSON string body"),
    data_file: Optional[str] = typer.Option(None, help="Path to JSON file body"),
) -> None:
    """Update settings."""
    payload = load_data(data, data_file)
    emit_output(state.api.put("/api/settings/", json_data=payload))


@app.command("reset")
@cli_command
def settings_reset() -> None:
    """Reset settings."""
    emit_output(state.api.post("/api/settings/reset"))


@app.command("verify")
@cli_command
def settings_verify() -> None:
    """Verify key/config."""
    emit_output(state.api.post("/api/settings/verify"))


@app.command("test")
@cli_command
def settings_test(
    name: str = typer.Option(..., help=f"Test name: {', '.join(TEST_NAMES)}"),
    data: Optional[str] = typer.Option(None, help="JSON string body"),
    data_file: Optional[str] = typer.Option(None, help="Path to JSON file body"),
) -> None:
    """Run async settings test."""
    payload = load_data(data, data_file)
    emit_output(state.api.post(f"/api/settings/tests/{name}", json_data=payload))


@app.command("test-status")
@cli_command
def settings_test_status(
    task_id: str = typer.Option(..., help="Task ID"),
) -> None:
    """Get settings test task status."""
    emit_output(state.api.get(f"/api/settings/tests/{task_id}/status"))
