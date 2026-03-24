"""Template commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from .common import ensure_file


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("templates", help="Template operations")
    child = parser.add_subparsers(dest="templates_action", required=True)

    p_upload = child.add_parser("upload", help="Upload project template image")
    p_upload.add_argument("--project-id", required=True)
    p_upload.add_argument("--file", required=True)
    p_upload.set_defaults(handler=cmd_upload)

    p_delete = child.add_parser("delete", help="Delete project template")
    p_delete.add_argument("--project-id", required=True)
    p_delete.set_defaults(handler=cmd_delete)


def cmd_upload(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    path = ensure_file(args.file)
    with path.open("rb") as f:
        return api.post(
            f"/api/projects/{args.project_id}/template",
            files={"template_image": (path.name, f)},
        )


def cmd_delete(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.delete(f"/api/projects/{args.project_id}/template")
