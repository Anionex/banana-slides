"""Settings commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from .common import add_data_options, load_data_args

TEST_NAMES = [
    "baidu-ocr",
    "text-model",
    "caption-model",
    "baidu-inpaint",
    "image-model",
    "mineru-pdf",
]


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("settings", help="Settings operations")
    child = parser.add_subparsers(dest="settings_action", required=True)

    p_get = child.add_parser("get", help="Get settings")
    p_get.set_defaults(handler=cmd_get)

    p_update = child.add_parser("update", help="Update settings")
    add_data_options(p_update)
    p_update.set_defaults(handler=cmd_update)

    p_reset = child.add_parser("reset", help="Reset settings")
    p_reset.set_defaults(handler=cmd_reset)

    p_verify = child.add_parser("verify", help="Verify key/config")
    p_verify.set_defaults(handler=cmd_verify)

    p_test = child.add_parser("test", help="Run async settings test")
    p_test.add_argument("--name", required=True, choices=TEST_NAMES)
    add_data_options(p_test)
    p_test.set_defaults(handler=cmd_test)

    p_status = child.add_parser("test-status", help="Get settings test task status")
    p_status.add_argument("--task-id", required=True)
    p_status.set_defaults(handler=cmd_test_status)


def cmd_get(api: APIClient, _cfg, _args: argparse.Namespace) -> dict:
    return api.get("/api/settings/")


def cmd_update(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = load_data_args(args)
    return api.put("/api/settings/", json_data=payload)


def cmd_reset(api: APIClient, _cfg, _args: argparse.Namespace) -> dict:
    return api.post("/api/settings/reset")


def cmd_verify(api: APIClient, _cfg, _args: argparse.Namespace) -> dict:
    return api.post("/api/settings/verify")


def cmd_test(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = load_data_args(args)
    return api.post(f"/api/settings/tests/{args.name}", json_data=payload)


def cmd_test_status(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/settings/tests/{args.task_id}/status")
