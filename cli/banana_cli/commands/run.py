"""High-level run commands."""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from ..errors import InputError
from ..http_client import APIClient
from ..jobs.loader import load_jobs
from ..jobs.runner import run_jobs
from ..reporter import write_report


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("run", help="High-level batch execution")
    child = parser.add_subparsers(dest="run_action", required=True)

    p_jobs = child.add_parser("jobs", help="Run jobs from JSONL/CSV")
    p_jobs.add_argument("--file", required=True, help="Path to jobs .jsonl or .csv")
    p_jobs.add_argument("--report", required=True, help="Output report JSON path")
    p_jobs.add_argument("--continue-on-error", dest="continue_on_error", action="store_true")
    p_jobs.add_argument("--fail-fast", dest="continue_on_error", action="store_false")
    p_jobs.add_argument("--timeout-sec", type=int, default=1800)
    p_jobs.add_argument("--state-file", help="Output run state JSON path")
    p_jobs.add_argument(
        "--done-marker-file",
        help="JSON file to mark successful job_ids and skip them on rerun",
    )
    p_jobs.add_argument(
        "--progress-interval-sec",
        type=int,
        default=60,
        help="Throttle terminal progress prints (seconds)",
    )
    p_jobs.set_defaults(handler=cmd_jobs, continue_on_error=None)

    p_monitor = child.add_parser("monitor", help="Monitor run progress from state file")
    p_monitor.add_argument("--state-file", required=True, help="Path to run state JSON")
    p_monitor.add_argument("--watch", action="store_true", help="Watch until run finishes")
    p_monitor.add_argument("--interval", type=int, default=60, help="Refresh interval seconds")
    p_monitor.set_defaults(handler=cmd_monitor)


def cmd_jobs(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    jobs = load_jobs(args.file)
    report = run_jobs(
        api,
        jobs,
        cfg,
        default_continue_on_error=args.continue_on_error,
        default_timeout_sec=args.timeout_sec,
        state_file=args.state_file,
        done_marker_file=args.done_marker_file,
        progress_interval_sec=args.progress_interval_sec,
    )
    out = write_report(report, args.report)

    return {
        "success": True,
        "data": {
            "report_path": str(out.resolve()),
            "run_id": report.run_id,
            "totals": report.totals,
            "jobs": [j.model_dump() for j in report.jobs],
        },
    }


def _read_state_file(state_file: str) -> dict:
    path = Path(state_file).expanduser()
    if not path.exists():
        raise InputError(f"State file not found: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise InputError(f"Invalid state file JSON: {path}", details=str(exc)) from exc


def _is_finished_status(status: str | None) -> bool:
    if not status:
        return False
    return status.startswith("COMPLETED")


def _progress_text(progress: dict | None) -> str:
    if not isinstance(progress, dict):
        return ""
    total = progress.get("total")
    completed = progress.get("completed")
    failed = progress.get("failed", 0)
    if total is None or completed is None:
        return ""
    return f"{completed}/{total} failed={failed}"


def _print_snapshot(snapshot: dict) -> None:
    now = datetime.now().strftime("%H:%M:%S")
    summary = snapshot.get("summary") or {}
    current_job_id = snapshot.get("current_job_id")
    jobs = snapshot.get("jobs") or []
    current_job = next((j for j in jobs if j.get("job_id") == current_job_id), None)

    total = summary.get("total", 0)
    done = summary.get("completed", 0)
    success = summary.get("success", 0)
    failed = summary.get("failed", 0)
    status = snapshot.get("status", "UNKNOWN")
    run_id = snapshot.get("run_id", "-")

    line = f"[{now}] run={run_id} status={status} done={done}/{total} success={success} failed={failed}"
    if current_job:
        stage = current_job.get("stage") or "-"
        job_progress = _progress_text(current_job.get("last_progress"))
        if job_progress:
            line += f" current={current_job_id} stage={stage} progress={job_progress}"
        else:
            line += f" current={current_job_id} stage={stage}"
    print(line)


def cmd_monitor(_api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    if args.interval <= 0:
        raise InputError("--interval must be > 0")

    if not args.watch:
        snapshot = _read_state_file(args.state_file)
        return {"success": True, "data": snapshot}

    while True:
        snapshot = _read_state_file(args.state_file)
        _print_snapshot(snapshot)

        if _is_finished_status(snapshot.get("status")):
            return {"success": True, "data": snapshot}
        time.sleep(args.interval)
