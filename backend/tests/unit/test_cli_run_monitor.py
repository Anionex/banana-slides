"""Tests for CLI run monitoring and run-state tracking."""

from __future__ import annotations

import json
from pathlib import Path

from cli.banana_cli.commands import run as run_cmd
from cli.banana_cli.config import CLIConfig
from cli.banana_cli.jobs import runner as run_runner
from cli.banana_cli.jobs.workflow import wait_task
from cli.banana_cli.models import ArtifactRecord, JobSpec, TaskRecord


class _DummyTaskAPI:
    def __init__(self):
        self.calls = 0

    def get(self, _path: str):
        self.calls += 1
        if self.calls == 1:
            return {
                "data": {
                    "status": "RUNNING",
                    "task_type": "GENERATE_IMAGES",
                    "progress": {"total": 2, "completed": 1, "failed": 0},
                }
            }
        return {
            "data": {
                "status": "COMPLETED",
                "task_type": "GENERATE_IMAGES",
                "progress": {"total": 2, "completed": 2, "failed": 0},
            }
        }


def test_wait_task_emits_progress_events():
    api = _DummyTaskAPI()
    events: list[dict] = []

    final = wait_task(
        api,  # type: ignore[arg-type]
        "proj-1",
        "task-1",
        timeout_sec=5,
        poll_interval=0,
        progress_callback=events.append,
    )

    assert final["status"] == "COMPLETED"
    assert events[0]["event"] == "task_polled"
    assert events[-1]["event"] == "task_completed"
    assert events[-1]["progress"]["completed"] == 2


def test_run_jobs_writes_state_file(tmp_path: Path, monkeypatch):
    state_file = tmp_path / "run-state.json"
    job = JobSpec.model_validate(
        {
            "job_id": "job-1",
            "job_type": "full_generation",
            "creation_type": "idea",
            "idea_prompt": "demo",
            "reference_files": [],
            "material_files": [],
            "export": {"formats": ["pptx"]},
        }
    )

    def _fake_execute(
        _api,
        _job,
        *,
        timeout_sec,
        poll_interval,
        progress_callback=None,
    ):
        assert timeout_sec > 0
        assert poll_interval > 0
        assert progress_callback is not None

        progress_callback({"event": "project_created", "project_id": "proj-1", "stage": "PROJECT_CREATED"})
        progress_callback(
            {
                "event": "task_started",
                "project_id": "proj-1",
                "task_id": "desc-1",
                "task_type": "GENERATE_DESCRIPTIONS",
                "status": "RUNNING",
            }
        )
        progress_callback(
            {
                "event": "task_polled",
                "project_id": "proj-1",
                "task_id": "desc-1",
                "task_type": "GENERATE_DESCRIPTIONS",
                "status": "RUNNING",
                "progress": {"total": 3, "completed": 2, "failed": 0},
            }
        )
        progress_callback(
            {
                "event": "task_completed",
                "project_id": "proj-1",
                "task_id": "desc-1",
                "task_type": "GENERATE_DESCRIPTIONS",
                "status": "COMPLETED",
                "progress": {"total": 3, "completed": 3, "failed": 0},
            }
        )
        progress_callback(
            {
                "event": "artifact_ready",
                "project_id": "proj-1",
                "format": "pptx",
                "download_url": "http://localhost/files/proj-1/exports/demo.pptx",
            }
        )

        return {
            "project_id": "proj-1",
            "tasks": [TaskRecord(task_id="desc-1", type="GENERATE_DESCRIPTIONS", status="COMPLETED")],
            "artifacts": [
                ArtifactRecord(
                    format="pptx",
                    download_url="http://localhost/files/proj-1/exports/demo.pptx",
                )
            ],
        }

    monkeypatch.setattr(run_runner, "execute_full_generation", _fake_execute)

    report = run_runner.run_jobs(
        object(),  # api is mocked by patched execute function
        [job],
        CLIConfig(base_url="http://localhost:5461"),
        state_file=str(state_file),
        progress_interval_sec=3600,
    )

    assert report.totals["total"] == 1
    assert report.totals["success"] == 1
    state = json.loads(state_file.read_text(encoding="utf-8"))
    assert state["status"] == "COMPLETED"
    assert state["summary"]["success"] == 1
    assert state["jobs"][0]["project_id"] == "proj-1"
    assert "desc-1" in state["jobs"][0]["tasks"]
    assert state["jobs"][0]["artifacts"][0]["format"] == "pptx"


def test_run_jobs_done_marker_skips_completed_job(tmp_path: Path, monkeypatch):
    marker_file = tmp_path / "done-markers.json"
    state_1 = tmp_path / "state-1.json"
    state_2 = tmp_path / "state-2.json"
    job = JobSpec.model_validate(
        {
            "job_id": "job-1",
            "job_type": "full_generation",
            "creation_type": "idea",
            "idea_prompt": "demo",
            "reference_files": [],
            "material_files": [],
            "export": {"formats": ["pptx"]},
        }
    )

    calls = {"count": 0}

    def _fake_execute(
        _api,
        _job,
        *,
        timeout_sec,
        poll_interval,
        progress_callback=None,
    ):
        assert timeout_sec > 0
        assert poll_interval > 0
        assert progress_callback is not None
        calls["count"] += 1
        progress_callback({"event": "project_created", "project_id": "proj-1", "stage": "PROJECT_CREATED"})
        progress_callback(
            {
                "event": "artifact_ready",
                "project_id": "proj-1",
                "format": "pptx",
                "download_url": "http://localhost/files/proj-1/exports/demo.pptx",
            }
        )
        return {
            "project_id": "proj-1",
            "tasks": [TaskRecord(task_id="desc-1", type="GENERATE_DESCRIPTIONS", status="COMPLETED")],
            "artifacts": [
                ArtifactRecord(
                    format="pptx",
                    download_url="http://localhost/files/proj-1/exports/demo.pptx",
                )
            ],
        }

    monkeypatch.setattr(run_runner, "execute_full_generation", _fake_execute)

    cfg = CLIConfig(base_url="http://localhost:5461")
    first = run_runner.run_jobs(
        object(),
        [job],
        cfg,
        state_file=str(state_1),
        done_marker_file=str(marker_file),
        progress_interval_sec=3600,
    )
    assert first.totals["success"] == 1
    assert calls["count"] == 1

    markers = json.loads(marker_file.read_text(encoding="utf-8"))
    assert "job-1" in markers["jobs"]
    assert markers["jobs"]["job-1"]["status"] == "SUCCESS"

    second = run_runner.run_jobs(
        object(),
        [job],
        cfg,
        state_file=str(state_2),
        done_marker_file=str(marker_file),
        progress_interval_sec=3600,
    )
    assert second.totals["success"] == 1
    assert calls["count"] == 1
    assert second.jobs[0].error.code == "SKIPPED_DONE_MARKER"

    state_payload = json.loads(state_2.read_text(encoding="utf-8"))
    assert state_payload["jobs"][0]["stage"] == "SKIPPED_DONE_MARKER"


def test_cmd_monitor_reads_snapshot(tmp_path: Path):
    snapshot = {
        "run_id": "run-1",
        "status": "RUNNING",
        "summary": {"total": 2, "completed": 0, "success": 0, "failed": 0},
        "current_job_id": None,
        "jobs": [],
    }
    state_file = tmp_path / "state.json"
    state_file.write_text(json.dumps(snapshot), encoding="utf-8")

    result = run_cmd.cmd_monitor(str(state_file), watch=False, interval=60)

    assert result["success"] is True
    assert result["data"]["run_id"] == "run-1"


def test_cmd_monitor_watch_until_completed(monkeypatch):
    snapshots = [
        {
            "run_id": "run-2",
            "status": "RUNNING",
            "summary": {"total": 1, "completed": 0, "success": 0, "failed": 0},
            "current_job_id": None,
            "jobs": [],
        },
        {
            "run_id": "run-2",
            "status": "COMPLETED",
            "summary": {"total": 1, "completed": 1, "success": 1, "failed": 0},
            "current_job_id": None,
            "jobs": [],
        },
    ]
    sleep_calls: list[int] = []

    def _fake_read(_state_file: str) -> dict:
        return snapshots.pop(0)

    monkeypatch.setattr(run_cmd, "_read_state_file", _fake_read)
    monkeypatch.setattr(run_cmd.time, "sleep", lambda sec: sleep_calls.append(sec))

    result = run_cmd.cmd_monitor("unused.json", watch=True, interval=5)

    assert result["success"] is True
    assert result["data"]["status"] == "COMPLETED"
    assert sleep_calls == [5]
