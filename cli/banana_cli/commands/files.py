"""File download command."""

from __future__ import annotations

import argparse

from ..http_client import APIClient


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("files", help="File transfer operations")
    child = parser.add_subparsers(dest="files_action", required=True)

    p_fetch = child.add_parser("fetch", help="Download file from /files URL")
    p_fetch.add_argument("--url", required=True, help="Relative /files/... or absolute URL")
    p_fetch.add_argument("--output", required=True)
    p_fetch.set_defaults(handler=cmd_fetch)


def cmd_fetch(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.download(args.url, args.output)
