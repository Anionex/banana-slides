"""Centralized output and error handling for CLI commands."""

from __future__ import annotations

import functools
import json
from typing import Any, Callable

import typer

from .errors import CLIError
from .state import state


def emit_output(result: Any) -> None:
    if result is None:
        return
    typer.echo(json.dumps(result, ensure_ascii=False, indent=2))


def emit_run_output(result: dict) -> None:
    data = result.get("data", {}) if isinstance(result, dict) else {}
    totals = data.get("totals", {})
    if not state.json_output:
        typer.echo(
            f"Run {data.get('run_id')}: total={totals.get('total', 0)} "
            f"success={totals.get('success', 0)} failed={totals.get('failed', 0)}"
        )
        typer.echo(f"Report: {data.get('report_path')}")
    else:
        typer.echo(json.dumps(result, ensure_ascii=False, indent=2))
    if totals.get("failed", 0) > 0:
        raise typer.Exit(code=2)


def cli_command(func: Callable) -> Callable:
    """Decorator that wraps CLI commands with error handling."""

    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except CLIError as exc:
            typer.echo(
                json.dumps({"success": False, "error": exc.to_dict()}, ensure_ascii=False, indent=2),
                err=True,
            )
            raise typer.Exit(code=1)
        except KeyboardInterrupt:
            typer.echo(
                json.dumps(
                    {"success": False, "error": {"code": "INTERRUPTED", "message": "Interrupted"}},
                    ensure_ascii=False,
                    indent=2,
                ),
                err=True,
            )
            raise typer.Exit(code=1)

    return wrapper
