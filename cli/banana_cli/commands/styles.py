"""Style extraction commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from .common import ensure_file


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("styles", help="Style extraction operations")
    child = parser.add_subparsers(dest="styles_action", required=True)

    p_extract = child.add_parser("extract", help="Extract style from image")
    p_extract.add_argument("--image", required=True)
    p_extract.set_defaults(handler=cmd_extract)


def cmd_extract(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    path = ensure_file(args.image)
    with path.open("rb") as f:
        return api.post("/api/extract-style", files={"image": (path.name, f)})
