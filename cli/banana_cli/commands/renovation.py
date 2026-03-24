"""PPT renovation commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from ..jobs.workflow import wait_task
from .common import ensure_file


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("renovation", help="PPT renovation operations")
    child = parser.add_subparsers(dest="renovation_action", required=True)

    p_create = child.add_parser("create", help="Create renovation project from ppt/pdf")
    p_create.add_argument("--file", required=True)
    p_create.add_argument("--keep-layout", action="store_true")
    p_create.add_argument("--template-style")
    p_create.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_create.add_argument("--wait", action="store_true")
    p_create.add_argument("--timeout-sec", type=int, default=1800)
    p_create.set_defaults(handler=cmd_create)


def cmd_create(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    path = ensure_file(args.file)
    form = {
        "keep_layout": "true" if args.keep_layout else "false",
    }
    if args.template_style:
        form["template_style"] = args.template_style
    if args.language:
        form["language"] = args.language

    with path.open("rb") as f:
        resp = api.post(
            "/api/projects/renovation",
            form_data=form,
            files={"file": (path.name, f)},
        )

    if not args.wait:
        return resp

    project_id = resp.get("data", {}).get("project_id")
    task_id = resp.get("data", {}).get("task_id")
    if not project_id or not task_id:
        return resp

    final = wait_task(
        api,
        project_id,
        task_id,
        timeout_sec=args.timeout_sec,
        poll_interval=cfg.poll_interval,
    )
    return {
        "success": True,
        "data": {
            "project_id": project_id,
            "task_id": task_id,
            "task": final,
        },
    }
