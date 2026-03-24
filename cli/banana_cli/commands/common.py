"""Shared helpers for command modules."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from ..errors import InputError


def add_data_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--data", help="JSON string body")
    parser.add_argument("--data-file", help="Path to JSON file body")


def load_data_args(args: argparse.Namespace) -> dict[str, Any]:
    if getattr(args, "data", None) and getattr(args, "data_file", None):
        raise InputError("Use either --data or --data-file, not both")
    if getattr(args, "data", None):
        try:
            parsed = json.loads(args.data)
        except json.JSONDecodeError as exc:
            raise InputError("Invalid JSON in --data", details=str(exc)) from exc
        if not isinstance(parsed, dict):
            raise InputError("--data must be a JSON object")
        return parsed
    if getattr(args, "data_file", None):
        path = Path(args.data_file)
        if not path.exists():
            raise InputError(f"JSON file not found: {path}")
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise InputError("Invalid JSON in --data-file", details=str(exc)) from exc
        if not isinstance(parsed, dict):
            raise InputError("--data-file must contain a JSON object")
        return parsed
    return {}


def parse_list_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def ensure_file(path_str: str) -> Path:
    path = Path(path_str)
    if not path.is_absolute():
        raise InputError(f"File path must be absolute: {path}")
    if not path.exists():
        raise InputError(f"File not found: {path}")
    return path
