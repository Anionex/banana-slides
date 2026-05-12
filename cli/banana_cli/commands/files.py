"""File download command."""

from __future__ import annotations

import typer

from ..output import cli_command, emit_output
from ..state import state

app = typer.Typer(no_args_is_help=True)


@app.command("fetch")
@cli_command
def files_fetch(
    url: str = typer.Option(..., help="Relative /files/... or absolute URL"),
    output: str = typer.Option(..., help="Output file path"),
) -> None:
    """Download file from /files URL."""
    emit_output(state.api.download(url, output))
