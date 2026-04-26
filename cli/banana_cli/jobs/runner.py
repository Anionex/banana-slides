"""Batch job runner."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from typing import Sequence

from ..config import CLIConfig
from ..errors import CLIError, IOErrorCLI
from ..http_client import APIClient
from ..models import ArtifactRecord, JobError, JobReport, JobSpec, RunReport, normalize_job_id
from ..reporter import finalize_report
from .workflow import execute_export_only, execute_full_generation


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _write_state_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp")
    try:
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:  # noqa: BLE001
        raise IOErrorCLI(f"Failed to write run state file: {path}", details=str(exc)) from exc


def _write_done_marker_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp")
    try:
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:  # noqa: BLE001
        raise IOErrorCLI(f"Failed to write done marker file: {path}", details=str(exc)) from exc


def _load_done_markers(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "schema": "banana-cli-done-markers/v1",
            "updated_at": None,
            "jobs": {},
        }

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise IOErrorCLI(f"Invalid done marker file JSON: {path}", details=str(exc)) from exc

    if not isinstance(payload, dict):
        raise IOErrorCLI(f"Invalid done marker file payload type: {path}", details="Expected JSON object")

    jobs = payload.get("jobs")
    if not isinstance(jobs, dict):
        jobs = {}

    return {
        "schema": payload.get("schema") or "banana-cli-done-markers/v1",
        "updated_at": payload.get("updated_at"),
        "jobs": jobs,
    }


def _marker_artifacts(marker_job: dict[str, Any]) -> list[ArtifactRecord]:
    result: list[ArtifactRecord] = []
    artifacts = marker_job.get("artifacts")
    if not isinstance(artifacts, list):
        return result

    for item in artifacts:
        if not isinstance(item, dict):
            continue
        dl = item.get("download_url")
        if not dl:
            continue
        fmt = item.get("format") or "pptx"
        result.append(ArtifactRecord(format=str(fmt), download_url=str(dl)))
    return result


def _progress_text(progress: dict[str, Any] | None) -> str:
    if not progress:
        return ""
    total = progress.get("total")
    completed = progress.get("completed")
    failed = progress.get("failed")
    if total is None or completed is None:
        return ""
    failed_val = 0 if failed is None else failed
    return f"{completed}/{total} failed={failed_val}"


def _format_progress_line(job_id: str, event: dict[str, Any]) -> str:
    stage = event.get("stage") or event.get("task_type") or event.get("event")
    status = event.get("status") or ""
    progress = _progress_text(event.get("progress"))

    if event.get("event") == "artifact_ready":
        return f"[{job_id}] ARTIFACT {event.get('format')} ready"
    if progress:
        return f"[{job_id}] {stage} {status} {progress}".strip()
    return f"[{job_id}] {stage} {status}".strip()


def run_jobs(
    api: APIClient,
    jobs: Sequence[JobSpec],
    config: CLIConfig,
    *,
    default_continue_on_error: bool | None = None,
    default_timeout_sec: int | None = None,
    state_file: str | None = None,
    done_marker_file: str | None = None,
    progress_interval_sec: int = 60,
) -> RunReport:
    report = RunReport(base_url=config.base_url)
    global_continue = config.continue_on_error if default_continue_on_error is None else default_continue_on_error
    global_timeout = 1800 if default_timeout_sec is None else default_timeout_sec
    progress_interval_sec = max(1, int(progress_interval_sec))

    state_path = Path(state_file).expanduser() if state_file else None
    marker_path = Path(done_marker_file).expanduser() if done_marker_file else None
    run_state: dict[str, Any] | None = None
    done_markers: dict[str, Any] | None = None

    if state_path is not None:
        run_state = {
            "schema": "banana-cli-run-state/v1",
            "run_id": report.run_id,
            "base_url": config.base_url,
            "started_at": report.started_at,
            "updated_at": report.started_at,
            "finished_at": None,
            "status": "RUNNING",
            "summary": {
                "total": len(jobs),
                "completed": 0,
                "success": 0,
                "failed": 0,
            },
            "current_job_id": None,
            "jobs": [],
        }
        _write_state_file(state_path, run_state)

    if marker_path is not None:
        done_markers = _load_done_markers(marker_path)

    def persist_state() -> None:
        if run_state is None or state_path is None:
            return
        run_state["updated_at"] = _utc_now_iso()
        _write_state_file(state_path, run_state)

    def persist_markers() -> None:
        if done_markers is None or marker_path is None:
            return
        done_markers["updated_at"] = _utc_now_iso()
        _write_done_marker_file(marker_path, done_markers)

    for idx, job in enumerate(jobs, start=1):
        job_id = normalize_job_id(job, idx)
        job_continue = job.policy.continue_on_error if job.policy else global_continue
        timeout_sec = job.policy.timeout_sec if job.policy and job.policy.timeout_sec else global_timeout
        last_printed_at = 0.0

        job_state: dict[str, Any] | None = None
        if run_state is not None:
            job_state = {
                "index": idx,
                "job_id": job_id,
                "status": "RUNNING",
                "stage": "STARTING",
                "project_id": job.project_id,
                "started_at": _utc_now_iso(),
                "completed_at": None,
                "current_task_id": None,
                "tasks": {},
                "artifacts": [],
                "last_progress": {},
                "error": None,
            }
            run_state["jobs"].append(job_state)
            run_state["current_job_id"] = job_id
            persist_state()

        marker_job = None
        if done_markers is not None:
            marker_jobs = done_markers.get("jobs") or {}
            if isinstance(marker_jobs, dict):
                marker_job = marker_jobs.get(job_id)

        marker_status = str((marker_job or {}).get("status") or "").upper() if isinstance(marker_job, dict) else ""
        if isinstance(marker_job, dict) and marker_status in {"", "SUCCESS"}:
            artifacts = _marker_artifacts(marker_job)
            project_id = marker_job.get("project_id")
            report.jobs.append(
                JobReport(
                    job_id=job_id,
                    status="SUCCESS",
                    project_id=project_id,
                    tasks=[],
                    artifacts=artifacts,
                    error=JobError(
                        code="SKIPPED_DONE_MARKER",
                        message="Skipped because this job_id is already marked done",
                    ),
                    duration_sec=0,
                )
            )
            print(f"[{job_id}] SKIPPED (DONE_MARKER)")
            if run_state is not None and job_state is not None:
                job_state["status"] = "SUCCESS"
                job_state["stage"] = "SKIPPED_DONE_MARKER"
                job_state["project_id"] = project_id
                job_state["duration_sec"] = 0
                job_state["completed_at"] = _utc_now_iso()
                job_state["error"] = {
                    "code": "SKIPPED_DONE_MARKER",
                    "message": "Skipped because this job_id is already marked done",
                }
                if artifacts:
                    job_state["artifacts"] = [a.model_dump() for a in artifacts]
                summary = run_state["summary"]
                summary["completed"] += 1
                summary["success"] += 1
                run_state["current_job_id"] = None
                persist_state()
            continue

        started = time.monotonic()

        def on_progress(event: dict[str, Any]) -> None:
            nonlocal last_printed_at
            if job_state is not None:
                project_id = event.get("project_id")
                if project_id:
                    job_state["project_id"] = project_id

                stage = event.get("stage") or event.get("task_type")
                if stage:
                    job_state["stage"] = stage

                task_id = event.get("task_id")
                if task_id:
                    task_item = job_state["tasks"].setdefault(task_id, {})
                    task_item["task_type"] = event.get("task_type")
                    task_item["status"] = event.get("status")
                    task_item["updated_at"] = _utc_now_iso()
                    progress = event.get("progress")
                    if isinstance(progress, dict):
                        task_item["progress"] = progress
                        job_state["last_progress"] = progress
                    job_state["current_task_id"] = task_id

                if event.get("event") == "artifact_ready":
                    job_state["artifacts"].append(
                        {
                            "format": event.get("format"),
                            "download_url": event.get("download_url"),
                        }
                    )

                persist_state()

            now = time.monotonic()
            must_print = event.get("event") in {
                "project_created",
                "stage_changed",
                "task_started",
                "task_completed",
                "task_failed",
                "artifact_ready",
            }
            if not must_print and now - last_printed_at < progress_interval_sec:
                return

            print(_format_progress_line(job_id, event))
            last_printed_at = now

        try:
            if job.job_type == "full_generation":
                outcome = execute_full_generation(
                    api,
                    job,
                    timeout_sec=timeout_sec,
                    poll_interval=config.poll_interval,
                    progress_callback=on_progress,
                )
            else:
                outcome = execute_export_only(
                    api,
                    job,
                    timeout_sec=timeout_sec,
                    poll_interval=config.poll_interval,
                    progress_callback=on_progress,
                )

            duration = int(time.monotonic() - started)
            job_report = JobReport(
                job_id=job_id,
                status="SUCCESS",
                project_id=outcome.get("project_id"),
                tasks=outcome.get("tasks", []),
                artifacts=outcome.get("artifacts", []),
                error=JobError(code=None, message=None),
                duration_sec=duration,
            )
            report.jobs.append(job_report)
            print(f"[{job_id}] SUCCESS in {duration}s")
            if run_state is not None and job_state is not None:
                job_state["status"] = "SUCCESS"
                job_state["duration_sec"] = duration
                job_state["completed_at"] = _utc_now_iso()
                summary = run_state["summary"]
                summary["completed"] += 1
                summary["success"] += 1
                run_state["current_job_id"] = None
                persist_state()

            if done_markers is not None:
                marker_jobs = done_markers.setdefault("jobs", {})
                if isinstance(marker_jobs, dict):
                    marker_jobs[job_id] = {
                        "job_id": job_id,
                        "status": "SUCCESS",
                        "project_id": job_report.project_id,
                        "artifacts": [a.model_dump() for a in job_report.artifacts],
                        "run_id": report.run_id,
                        "marked_at": _utc_now_iso(),
                    }
                    persist_markers()
        except CLIError as exc:
            duration = int(time.monotonic() - started)
            report.jobs.append(
                JobReport(
                    job_id=job_id,
                    status="FAILED",
                    project_id=job.project_id,
                    tasks=[],
                    artifacts=[],
                    error=JobError(code=exc.code, message=exc.message),
                    duration_sec=duration,
                )
            )
            print(f"[{job_id}] FAILED ({exc.code}): {exc.message}")
            if run_state is not None and job_state is not None:
                job_state["status"] = "FAILED"
                job_state["duration_sec"] = duration
                job_state["completed_at"] = _utc_now_iso()
                job_state["error"] = {"code": exc.code, "message": exc.message}
                summary = run_state["summary"]
                summary["completed"] += 1
                summary["failed"] += 1
                run_state["current_job_id"] = None
                persist_state()
            if not job_continue:
                break
        except Exception as exc:  # noqa: BLE001
            duration = int(time.monotonic() - started)
            report.jobs.append(
                JobReport(
                    job_id=job_id,
                    status="FAILED",
                    project_id=job.project_id,
                    tasks=[],
                    artifacts=[],
                    error=JobError(code="UNEXPECTED_ERROR", message=str(exc)),
                    duration_sec=duration,
                )
            )
            print(f"[{job_id}] FAILED (UNEXPECTED_ERROR): {exc}")
            if run_state is not None and job_state is not None:
                job_state["status"] = "FAILED"
                job_state["duration_sec"] = duration
                job_state["completed_at"] = _utc_now_iso()
                job_state["error"] = {"code": "UNEXPECTED_ERROR", "message": str(exc)}
                summary = run_state["summary"]
                summary["completed"] += 1
                summary["failed"] += 1
                run_state["current_job_id"] = None
                persist_state()
            if not job_continue:
                break

    if run_state is not None:
        run_state["finished_at"] = _utc_now_iso()
        run_state["status"] = "COMPLETED_WITH_FAILURES" if run_state["summary"]["failed"] > 0 else "COMPLETED"
        run_state["current_job_id"] = None
        persist_state()

    return finalize_report(report)
