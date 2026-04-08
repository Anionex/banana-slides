"""Module entry point for banana-cli."""

from __future__ import annotations

from .app import app


def main() -> None:
    app()


if __name__ == "__main__":
    main()
