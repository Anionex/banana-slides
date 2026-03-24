"""Task status commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from ..jobs.workflow import wait_task


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("tasks", help="Task operations")
    child = parser.add_subparsers(dest="tasks_action", required=True)

    p_status = child.add_parser("status", help="Get task status")
    p_status.add_argument("--project-id", required=True)
    p_status.add_argument("--task-id", required=True)
    p_status.set_defaults(handler=cmd_status)

    p_wait = child.add_parser("wait", help="Wait for task completion")
    p_wait.add_argument("--project-id", required=True)
    p_wait.add_argument("--task-id", required=True)
    p_wait.add_argument("--timeout-sec", type=int, default=1800)
    p_wait.set_defaults(handler=cmd_wait)


def cmd_status(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/projects/{args.project_id}/tasks/{args.task_id}")


def cmd_wait(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    status = wait_task(
        api,
        args.project_id,
        args.task_id,
        timeout_sec=args.timeout_sec,
        poll_interval=cfg.poll_interval,
    )
    return {"success": True, "data": status}
