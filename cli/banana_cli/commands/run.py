"""High-level run commands."""

from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import typer

from ..errors import InputError
from ..jobs.loader import load_jobs
from ..jobs.runner import run_jobs
from ..output import cli_command, emit_run_output
from ..reporter import write_report
from ..state import state

app = typer.Typer(no_args_is_help=True)


@app.command("jobs")
@cli_command
def run_jobs_cmd(
    file: str = typer.Option(..., help="Path to jobs .jsonl or .csv"),
    report: str = typer.Option(..., help="Output report JSON path"),
    continue_on_error: Optional[bool] = typer.Option(None, "--continue-on-error/--fail-fast"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
    state_file: Optional[str] = typer.Option(None, help="Output run state JSON path"),
    done_marker_file: Optional[str] = typer.Option(None, help="JSON file to track completed jobs"),
    progress_interval_sec: int = typer.Option(60, help="Throttle terminal progress prints"),
) -> None:
    """Run jobs from JSONL/CSV."""
    jobs = load_jobs(file)
    report_result = run_jobs(
        state.api,
        jobs,
        state.config,
        default_continue_on_error=continue_on_error,
        default_timeout_sec=timeout_sec,
        state_file=state_file,
        done_marker_file=done_marker_file,
        progress_interval_sec=progress_interval_sec,
    )
    out = write_report(report_result, report)

    emit_run_output({
        "success": True,
        "data": {
            "report_path": str(out.resolve()),
            "run_id": report_result.run_id,
            "totals": report_result.totals,
            "jobs": [j.model_dump() for j in report_result.jobs],
        },
    })


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


def cmd_monitor(state_file: str, watch: bool, interval: int) -> dict:
    """Monitor run progress (internal function for testing)."""
    if interval <= 0:
        raise InputError("--interval must be > 0")

    if not watch:
        snapshot = _read_state_file(state_file)
        return {"success": True, "data": snapshot}

    while True:
        snapshot = _read_state_file(state_file)
        _print_snapshot(snapshot)

        if _is_finished_status(snapshot.get("status")):
            return {"success": True, "data": snapshot}
        time.sleep(interval)


@app.command("monitor")
@cli_command
def run_monitor(
    state_file: str = typer.Option(..., help="Path to run state JSON"),
    watch: bool = typer.Option(False, help="Watch until run finishes"),
    interval: int = typer.Option(60, help="Refresh interval seconds"),
) -> None:
    """Monitor run progress from state file."""
    from ..output import emit_output
    result = cmd_monitor(state_file, watch, interval)
    emit_output(result)
