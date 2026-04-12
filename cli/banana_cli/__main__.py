"""Module entry point for banana-cli."""

from __future__ import annotations

import sys

import typer.core

# Disable Rich markup in --help when stdout is not a TTY (e.g. piped to AI agent).
# This produces plain-text help output that's cheaper on tokens and avoids truncation.
if not sys.stdout.isatty():
    typer.core.HAS_RICH = False

from .app import app


def main() -> None:
    app()


if __name__ == "__main__":
    main()
