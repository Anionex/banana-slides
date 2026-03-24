"""Module entry point for banana-cli."""

from __future__ import annotations

import sys

from .app import run_cli


def main() -> None:
    raise SystemExit(run_cli())


if __name__ == "__main__":
    main()
