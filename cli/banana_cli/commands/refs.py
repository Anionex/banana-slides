"""Reference file commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from .common import ensure_file


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("refs", help="Reference file operations")
    child = parser.add_subparsers(dest="refs_action", required=True)

    p_upload = child.add_parser("upload", help="Upload reference file")
    p_upload.add_argument("--file", required=True)
    p_upload.add_argument("--project-id")
    p_upload.set_defaults(handler=cmd_upload)

    p_list = child.add_parser("list", help="List reference files")
    p_list.add_argument("--project-id", default="all")
    p_list.set_defaults(handler=cmd_list)

    p_get = child.add_parser("get", help="Get single reference file")
    p_get.add_argument("--file-id", required=True)
    p_get.set_defaults(handler=cmd_get)

    p_parse = child.add_parser("parse", help="Trigger parsing")
    p_parse.add_argument("--file-id", required=True)
    p_parse.set_defaults(handler=cmd_parse)

    p_assoc = child.add_parser("associate", help="Associate file to project")
    p_assoc.add_argument("--file-id", required=True)
    p_assoc.add_argument("--project-id", required=True)
    p_assoc.set_defaults(handler=cmd_associate)

    p_dis = child.add_parser("dissociate", help="Dissociate file from project")
    p_dis.add_argument("--file-id", required=True)
    p_dis.set_defaults(handler=cmd_dissociate)

    p_del = child.add_parser("delete", help="Delete reference file")
    p_del.add_argument("--file-id", required=True)
    p_del.set_defaults(handler=cmd_delete)


def cmd_upload(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    path = ensure_file(args.file)
    form = {}
    if args.project_id:
        form["project_id"] = args.project_id
    with path.open("rb") as f:
        return api.post(
            "/api/reference-files/upload",
            form_data=form,
            files={"file": (path.name, f)},
        )


def cmd_list(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/reference-files/project/{args.project_id}")


def cmd_get(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/reference-files/{args.file_id}")


def cmd_parse(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.post(f"/api/reference-files/{args.file_id}/parse")


def cmd_associate(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.post(
        f"/api/reference-files/{args.file_id}/associate",
        json_data={"project_id": args.project_id},
    )


def cmd_dissociate(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.post(f"/api/reference-files/{args.file_id}/dissociate")


def cmd_delete(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.delete(f"/api/reference-files/{args.file_id}")
