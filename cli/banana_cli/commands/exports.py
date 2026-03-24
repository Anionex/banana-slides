"""Export commands."""

from __future__ import annotations

import argparse
from urllib.parse import urljoin

from ..http_client import APIClient
from ..jobs.workflow import wait_task
from .common import parse_list_csv


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("exports", help="Export operations")
    child = parser.add_subparsers(dest="exports_action", required=True)

    for name in ("pptx", "pdf", "images"):
        p = child.add_parser(name, help=f"Export {name}")
        p.add_argument("--project-id", required=True)
        p.add_argument("--filename")
        p.add_argument("--page-ids", help="Comma-separated page IDs")
        p.set_defaults(handler=cmd_basic_export, export_type=name)

    p_edit = child.add_parser("editable-pptx", help="Export editable PPTX asynchronously")
    p_edit.add_argument("--project-id", required=True)
    p_edit.add_argument("--filename")
    p_edit.add_argument("--page-ids", help="Comma-separated page IDs")
    p_edit.add_argument("--max-depth", type=int, default=1)
    p_edit.add_argument("--max-workers", type=int, default=4)
    p_edit.add_argument("--wait", action="store_true")
    p_edit.add_argument("--timeout-sec", type=int, default=1800)
    p_edit.set_defaults(handler=cmd_editable_export)


def cmd_basic_export(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    params = {}
    if args.filename:
        params["filename"] = args.filename
    page_ids = parse_list_csv(args.page_ids)
    if page_ids:
        params["page_ids"] = ",".join(page_ids)

    return api.get(f"/api/projects/{args.project_id}/export/{args.export_type}", params=params)


def cmd_editable_export(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    body = {
        "max_depth": args.max_depth,
        "max_workers": args.max_workers,
    }
    if args.filename:
        body["filename"] = args.filename
    page_ids = parse_list_csv(args.page_ids)
    if page_ids:
        body["page_ids"] = page_ids

    resp = api.post(f"/api/projects/{args.project_id}/export/editable-pptx", json_data=body)
    if not args.wait:
        return resp

    task_id = resp.get("data", {}).get("task_id")
    if not task_id:
        return resp

    task_data = wait_task(
        api,
        args.project_id,
        task_id,
        timeout_sec=args.timeout_sec,
        poll_interval=cfg.poll_interval,
    )

    progress = task_data.get("progress") or {}
    dl = progress.get("download_url")
    if dl and not dl.startswith(("http://", "https://")):
        dl = urljoin(api.config.base_url + "/", dl.lstrip("/"))

    return {
        "success": True,
        "data": {
            "task_id": task_id,
            "task": task_data,
            "download_url": dl,
        },
    }
