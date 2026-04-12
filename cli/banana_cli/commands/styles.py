"""Style extraction commands."""

from __future__ import annotations

import typer

from ..output import cli_command, emit_output
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("extract")
@cli_command
def styles_extract(
    image: str = typer.Option(..., help="Absolute image path"),
) -> None:
    """Extract style from image."""
    path = ensure_file(image)
    with path.open("rb") as f:
        emit_output(state.api.post("/api/extract-style", files={"image": (path.name, f)}))
