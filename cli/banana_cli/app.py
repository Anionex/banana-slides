"""CLI app entry and command dispatch."""

from __future__ import annotations

import argparse
import json
from typing import Any

from .config import resolve_config
from .errors import CLIError
from .http_client import APIClient
from .commands import (
    exports,
    files,
    materials,
    pages,
    projects,
    refs,
    renovation,
    run,
    settings,
    styles,
    tasks,
    templates,
    workflows,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="banana-cli", description="Banana Slides API-driven CLI")
    parser.add_argument("--base-url", help="Backend base URL, default http://localhost:5000")
    parser.add_argument("--access-code", help="Optional X-Access-Code header")
    parser.add_argument("--poll-interval", type=int, help="Task polling interval seconds")
    parser.add_argument("--request-timeout", type=int, help="Request timeout seconds")
    parser.add_argument("--config", help="Config file path (TOML)")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    subparsers = parser.add_subparsers(dest="domain", required=True)
    run.register(subparsers)
    projects.register(subparsers)
    workflows.register(subparsers)
    tasks.register(subparsers)
    pages.register(subparsers)
    templates.register(subparsers)
    exports.register(subparsers)
    refs.register(subparsers)
    materials.register(subparsers)
    settings.register(subparsers)
    renovation.register(subparsers)
    styles.register(subparsers)
    files.register(subparsers)

    return parser


def _emit_output(result: Any, json_output: bool, args: argparse.Namespace) -> int:
    if result is None:
        return 0

    if args.domain == "run" and getattr(args, "run_action", None) == "jobs":
        data = result.get("data", {}) if isinstance(result, dict) else {}
        totals = data.get("totals", {})
        if not json_output:
            print(
                f"Run {data.get('run_id')}: total={totals.get('total', 0)} "
                f"success={totals.get('success', 0)} failed={totals.get('failed', 0)}"
            )
            print(f"Report: {data.get('report_path')}")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if totals.get("failed", 0) > 0 else 0

    if json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def run_cli(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        cfg = resolve_config(args)
        api = APIClient(cfg)
        handler = getattr(args, "handler", None)
        if handler is None:
            parser.error("No command handler configured")
        result = handler(api, cfg, args)
        return _emit_output(result, cfg.json_output, args)
    except CLIError as exc:
        print(json.dumps({"success": False, "error": exc.to_dict()}, ensure_ascii=False, indent=2))
        return 1
    except KeyboardInterrupt:
        print(json.dumps({"success": False, "error": {"code": "INTERRUPTED", "message": "Interrupted"}}, ensure_ascii=False, indent=2))
        return 1
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "success": False,
                    "error": {"code": "UNEXPECTED_ERROR", "message": str(exc)},
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1
