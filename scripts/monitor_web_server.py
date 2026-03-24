#!/usr/bin/env python3
"""Micro web dashboard for batch PPT monitoring."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from flask import Flask, jsonify, send_from_directory


ROOT_DIR = Path(__file__).resolve().parents[1]
JOB_FILES = [
    ROOT_DIR / "scripts" / "job_templates" / "junior_prompts_batch_A.jsonl",
    ROOT_DIR / "scripts" / "job_templates" / "junior_prompts_batch_B.jsonl",
    ROOT_DIR / "scripts" / "job_templates" / "junior_prompts_batch_C.jsonl",
]
STATES_DIR = ROOT_DIR / "scripts" / "job_templates" / "states"
REPORTS_DIR = ROOT_DIR / "scripts" / "job_templates" / "reports"
DONE_MARKER_FILE = ROOT_DIR / "scripts" / "job_templates" / "states" / "junior_done_markers.json"
STATIC_DIR = ROOT_DIR / "scripts" / "monitor_web"
UPLOADS_DIR = ROOT_DIR / "uploads"


def _parse_iso(value: str | None) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, tz=timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        return datetime.fromtimestamp(0, tz=timezone.utc)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class JobDef:
    index: int
    job_id: str
    file_path: str
    file_label: str
    cfg_desc_workers: int
    cfg_img_workers: int
    filename_prefix: str


class DashboardAggregator:
    def __init__(self, *, base_url: str, access_code: str = "") -> None:
        self.base_url = base_url.rstrip("/")
        self.access_code = access_code
        self._project_cache: dict[str, tuple[datetime, dict[str, Any] | None]] = {}

    def build_snapshot(self) -> dict[str, Any]:
        job_defs = self._load_job_defs()
        states = self._load_state_runs()
        reports = self._load_report_runs()
        done_markers = self._load_done_markers()

        primary_state = self._pick_primary_state(states)
        state_jobs: dict[str, dict[str, Any]] = {}
        primary_is_running = False
        if primary_state:
            primary_is_running = str(primary_state.get("data", {}).get("status", "")).upper() == "RUNNING"
            for item in primary_state.get("data", {}).get("jobs", []):
                job_id = str(item.get("job_id") or "")
                if job_id:
                    state_jobs[job_id] = item

        latest_by_job = self._latest_status_by_job(states, reports)
        attempts_by_job = self._attempts_by_job(states, reports)

        rows: list[dict[str, Any]] = []
        project_ids: set[str] = set()
        for job in job_defs:
            current_state = state_jobs.get(job.job_id)
            latest = latest_by_job.get(job.job_id)
            attempts = attempts_by_job.get(job.job_id, [])
            marker = done_markers.get(job.job_id)

            status = "QUEUED"
            stage = "QUEUED"
            progress = {"total": None, "completed": None, "failed": 0}
            project_id: str | None = None
            updated_at = ""

            if latest:
                status = str(latest.get("status") or status).upper()
                stage = str(latest.get("stage") or stage)
                project_id = latest.get("project_id")
                updated_at = str(latest.get("updated_at") or "")

            if current_state:
                status = str(current_state.get("status") or status).upper()
                stage = str(current_state.get("stage") or stage)
                project_id = current_state.get("project_id") or project_id
                updated_at = str(
                    current_state.get("completed_at")
                    or current_state.get("started_at")
                    or updated_at
                )
                progress = self._extract_progress(current_state)
            elif primary_is_running and latest is None:
                # During an active run, jobs absent from current state are queued in this run.
                status = "QUEUED"
                stage = "QUEUED"
                project_id = None
                updated_at = ""

            marker_project_id = None
            marker_updated_at = ""
            if isinstance(marker, dict):
                marker_project_id = marker.get("project_id")
                marker_updated_at = str(marker.get("marked_at") or "")
                # Done marker has higher priority than queued/failed fallback states.
                if status != "RUNNING":
                    status = "SUCCESS"
                    stage = "DONE_MARKER"
                    if not project_id:
                        project_id = marker_project_id
                    if not updated_at:
                        updated_at = marker_updated_at

            if project_id:
                project_ids.add(project_id)

            pages_total = progress.get("total")
            pages_completed = progress.get("completed")
            pages_failed = progress.get("failed", 0) or 0

            active_desc, active_img = self._estimate_active_threads(
                status=status,
                stage=stage,
                cfg_desc=job.cfg_desc_workers,
                cfg_img=job.cfg_img_workers,
            )

            attempt_count = len(attempts)
            retry_count = max(attempt_count - 1, 0)
            err_count = len([a for a in attempts if str(a.get("status", "")).upper() == "FAILED"])

            remaining: int | None = None
            if isinstance(pages_total, int) and isinstance(pages_completed, int):
                remaining = max(pages_total - pages_completed - int(pages_failed), 0)

            rows.append(
                {
                    "index": job.index,
                    "job_id": job.job_id,
                    "file": job.file_path,
                    "file_label": job.file_label,
                    "filename_prefix": job.filename_prefix,
                    "status": status,
                    "stage": stage,
                    "project_id": project_id,
                    "pages": {
                        "total": pages_total,
                        "completed": pages_completed,
                        "failed": pages_failed,
                    },
                    "remaining": remaining,
                    "threads": {
                        "active_desc": active_desc,
                        "active_img": active_img,
                        "cfg_desc": job.cfg_desc_workers,
                        "cfg_img": job.cfg_img_workers,
                        "text": (
                            f"active {active_desc}/{active_img} | "
                            f"cfg {job.cfg_desc_workers}/{job.cfg_img_workers}"
                        ),
                    },
                    "err_count": err_count,
                    "retry_count": retry_count,
                    "updated_at": updated_at,
                    "done_marked": isinstance(marker, dict),
                    "done_marked_at": marker_updated_at,
                }
            )

        project_details = self._fetch_projects(project_ids)
        row_map = {row["job_id"]: row for row in rows}
        project_to_job = {
            row["project_id"]: row["job_id"]
            for row in rows
            if row.get("project_id")
        }

        for project_id, project in project_details.items():
            if not project:
                continue
            job_id = project_to_job.get(project_id)
            if not job_id:
                continue
            pages = project.get("pages") or []
            row = row_map[job_id]

            pages_total = len(pages)
            if pages_total > 0 and row["pages"]["total"] is None:
                row["pages"]["total"] = pages_total
                if row["status"] == "SUCCESS":
                    row["pages"]["completed"] = pages_total
                    row["remaining"] = 0

        images = self._collect_images(project_details, row_map, project_to_job)
        summary = self._build_summary(rows)

        return {
            "generated_at": _now_iso(),
            "base_url": self.base_url,
            "summary": summary,
            "rows": rows,
            "images": images,
        }

    def _load_job_defs(self) -> list[JobDef]:
        defs: list[JobDef] = []
        row_idx = 1
        for file_path in JOB_FILES:
            if not file_path.exists():
                continue
            lines = file_path.read_text(encoding="utf-8").splitlines()
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                payload = json.loads(stripped)
                ref_files = payload.get("reference_files") or []
                ref_path = str(ref_files[0]) if ref_files else ""
                job_id = str(payload.get("job_id") or f"job-{row_idx:03d}")
                cfg_desc = int(payload.get("max_description_workers") or 0)
                cfg_img = int(payload.get("max_image_workers") or 0)
                filename_prefix = str(payload.get("export", {}).get("filename_prefix") or "")
                defs.append(
                    JobDef(
                        index=row_idx,
                        job_id=job_id,
                        file_path=ref_path,
                        file_label=Path(ref_path).name if ref_path else job_id,
                        cfg_desc_workers=cfg_desc,
                        cfg_img_workers=cfg_img,
                        filename_prefix=filename_prefix,
                    )
                )
                row_idx += 1
        return defs

    def _load_state_runs(self) -> list[dict[str, Any]]:
        runs: list[dict[str, Any]] = []
        if not STATES_DIR.exists():
            return runs
        for path in sorted(STATES_DIR.glob("*_state.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                continue
            updated = _parse_iso(
                data.get("updated_at")
                or data.get("finished_at")
                or data.get("started_at")
            )
            runs.append({"path": str(path), "updated": updated, "data": data})
        return runs

    def _load_done_markers(self) -> dict[str, dict[str, Any]]:
        if not DONE_MARKER_FILE.exists():
            return {}
        try:
            payload = json.loads(DONE_MARKER_FILE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
        jobs = payload.get("jobs")
        if not isinstance(jobs, dict):
            return {}
        # Keep only dict payloads keyed by job_id.
        result: dict[str, dict[str, Any]] = {}
        for job_id, item in jobs.items():
            if isinstance(item, dict):
                result[str(job_id)] = item
        return result

    def _load_report_runs(self) -> list[dict[str, Any]]:
        runs: list[dict[str, Any]] = []
        if not REPORTS_DIR.exists():
            return runs
        for path in sorted(REPORTS_DIR.glob("*_report.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                continue
            updated = _parse_iso(
                data.get("finished_at")
                or data.get("started_at")
            )
            runs.append({"path": str(path), "updated": updated, "data": data})
        return runs

    @staticmethod
    def _pick_primary_state(states: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not states:
            return None
        running = [s for s in states if str(s["data"].get("status", "")).upper() == "RUNNING"]
        if running:
            running.sort(key=lambda item: item["updated"], reverse=True)
            return running[0]
        states.sort(key=lambda item: item["updated"], reverse=True)
        return states[0]

    def _latest_status_by_job(
        self,
        states: list[dict[str, Any]],
        reports: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        latest: dict[str, dict[str, Any]] = {}

        for run in states:
            ts = run["updated"]
            for job in run["data"].get("jobs", []):
                job_id = str(job.get("job_id") or "")
                if not job_id:
                    continue
                existing = latest.get(job_id)
                if existing and existing["ts"] >= ts:
                    continue
                latest[job_id] = {
                    "ts": ts,
                    "status": str(job.get("status") or "").upper(),
                    "stage": job.get("stage"),
                    "project_id": job.get("project_id"),
                    "updated_at": job.get("completed_at") or job.get("started_at"),
                }

        for run in reports:
            ts = run["updated"]
            for job in run["data"].get("jobs", []):
                job_id = str(job.get("job_id") or "")
                if not job_id:
                    continue
                existing = latest.get(job_id)
                if existing and existing["ts"] >= ts:
                    continue
                latest[job_id] = {
                    "ts": ts,
                    "status": str(job.get("status") or "").upper(),
                    "stage": "DONE" if str(job.get("status") or "").upper() == "SUCCESS" else "FAILED",
                    "project_id": job.get("project_id"),
                    "updated_at": run["data"].get("finished_at") or run["data"].get("started_at"),
                }
        return latest

    def _attempts_by_job(
        self,
        states: list[dict[str, Any]],
        reports: list[dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        attempts: dict[str, list[dict[str, Any]]] = {}

        if states:
            for run in states:
                source = run["path"]
                ts = run["updated"]
                for job in run["data"].get("jobs", []):
                    job_id = str(job.get("job_id") or "")
                    if not job_id:
                        continue
                    attempts.setdefault(job_id, []).append(
                        {
                            "source": source,
                            "ts": ts,
                            "status": str(job.get("status") or "").upper(),
                            "project_id": job.get("project_id"),
                        }
                    )
            return attempts

        for run in reports:
            source = run["path"]
            ts = run["updated"]
            for job in run["data"].get("jobs", []):
                job_id = str(job.get("job_id") or "")
                if not job_id:
                    continue
                attempts.setdefault(job_id, []).append(
                    {
                        "source": source,
                        "ts": ts,
                        "status": str(job.get("status") or "").upper(),
                        "project_id": job.get("project_id"),
                    }
                )
        return attempts

    @staticmethod
    def _extract_progress(job_state: dict[str, Any]) -> dict[str, Any]:
        progress = job_state.get("last_progress")
        if isinstance(progress, dict) and progress.get("total") is not None:
            return {
                "total": progress.get("total"),
                "completed": progress.get("completed"),
                "failed": progress.get("failed", 0),
            }

        tasks = job_state.get("tasks") or {}
        current_task_id = job_state.get("current_task_id")
        if current_task_id and isinstance(tasks, dict):
            task = tasks.get(current_task_id) or {}
            tprogress = task.get("progress")
            if isinstance(tprogress, dict) and tprogress.get("total") is not None:
                return {
                    "total": tprogress.get("total"),
                    "completed": tprogress.get("completed"),
                    "failed": tprogress.get("failed", 0),
                }

        if isinstance(tasks, dict):
            for task in tasks.values():
                tprogress = task.get("progress")
                if isinstance(tprogress, dict) and tprogress.get("total") is not None:
                    return {
                        "total": tprogress.get("total"),
                        "completed": tprogress.get("completed"),
                        "failed": tprogress.get("failed", 0),
                    }

        return {"total": None, "completed": None, "failed": 0}

    @staticmethod
    def _estimate_active_threads(
        *,
        status: str,
        stage: str,
        cfg_desc: int,
        cfg_img: int,
    ) -> tuple[int, int]:
        if status != "RUNNING":
            return 0, 0
        stage_u = stage.upper()
        if "DESCRIPTION" in stage_u:
            return cfg_desc, 0
        if "IMAGE" in stage_u:
            return 0, cfg_img
        return 0, 0

    def _fetch_projects(self, project_ids: set[str]) -> dict[str, dict[str, Any] | None]:
        result: dict[str, dict[str, Any] | None] = {}
        if not project_ids:
            return result

        headers: dict[str, str] = {}
        if self.access_code:
            headers["X-Access-Code"] = self.access_code

        for project_id in project_ids:
            cached = self._project_cache.get(project_id)
            now = datetime.now(timezone.utc)
            if cached and (now - cached[0]).total_seconds() < 10:
                result[project_id] = cached[1]
                continue

            url = f"{self.base_url}/api/projects/{project_id}"
            data: dict[str, Any] | None
            try:
                with httpx.Client(timeout=1.5) as client:
                    resp = client.get(url, headers=headers)
                if not resp.is_success:
                    data = cached[1] if cached else None
                else:
                    payload = resp.json()
                    data = payload.get("data") if isinstance(payload, dict) else None
            except Exception:  # noqa: BLE001
                data = cached[1] if cached else None

            self._project_cache[project_id] = (now, data)
            result[project_id] = data
        return result

    def _collect_images(
        self,
        project_details: dict[str, dict[str, Any] | None],
        row_map: dict[str, dict[str, Any]],
        project_to_job: dict[str, str],
    ) -> list[dict[str, Any]]:
        images: list[dict[str, Any]] = []
        page_meta_lookup: dict[tuple[str, str], dict[str, Any]] = {}
        for project_id, project in project_details.items():
            if not project:
                continue
            job_id = project_to_job.get(project_id)
            if not job_id:
                continue
            row = row_map[job_id]
            for page in project.get("pages") or []:
                rel_url = page.get("generated_image_url")
                if not rel_url:
                    continue
                rel_text = str(rel_url)
                parsed = urlparse(rel_text)
                url_path = parsed.path if parsed.scheme else rel_text
                filename = Path(url_path).name
                if filename:
                    image_url = f"/media/{project_id}/{filename}"
                else:
                    image_url = f"{self.base_url}/{str(rel_url).lstrip('/')}"
                page_id = page.get("page_id")
                page_order = page.get("order_index")
                outline_content = page.get("outline_content") or {}
                if not isinstance(outline_content, dict):
                    outline_content = {}
                page_no = page_order + 1 if isinstance(page_order, int) else None
                chapter = page.get("part") or outline_content.get("part") or ""
                page_title = outline_content.get("title") or ""
                if page_id:
                    page_meta_lookup[(project_id, str(page_id))] = {
                        "page_order": page_order,
                        "page_no": page_no,
                        "chapter": chapter,
                        "page_title": page_title,
                    }
                images.append(
                    {
                        "project_id": project_id,
                        "job_id": job_id,
                        "file_label": row["file_label"],
                        "page_order": page_order,
                        "page_no": page_no,
                        "page_id": page_id,
                        "chapter": chapter,
                        "page_title": page_title,
                        "updated_at": page.get("updated_at"),
                        "image_url": image_url,
                    }
                )

        # Fallback: read locally generated images even when project API is slow.
        existing_urls = {img["image_url"] for img in images}
        for row in row_map.values():
            project_id = row.get("project_id")
            if not project_id:
                continue
            pages_dir = ROOT_DIR / "uploads" / str(project_id) / "pages"
            if not pages_dir.exists():
                continue

            files = sorted(
                pages_dir.glob("*_thumb.jpg"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if not files:
                files = sorted(
                    pages_dir.glob("*.png"),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )

            for path in files:
                image_url = f"/media/{project_id}/{path.name}"
                if image_url in existing_urls:
                    continue

                stem = path.name
                page_id = stem.split("_v", 1)[0] if "_v" in stem else stem
                meta = page_meta_lookup.get((str(project_id), str(page_id)), {})
                page_order = meta.get("page_order")
                page_no = meta.get("page_no")
                chapter = meta.get("chapter", "")
                page_title = meta.get("page_title", "")
                updated_at = datetime.fromtimestamp(
                    path.stat().st_mtime, tz=timezone.utc
                ).isoformat()

                images.append(
                    {
                        "project_id": project_id,
                        "job_id": row["job_id"],
                        "file_label": row["file_label"],
                        "page_order": page_order,
                        "page_no": page_no,
                        "page_id": page_id,
                        "chapter": chapter,
                        "page_title": page_title,
                        "updated_at": updated_at,
                        "image_url": image_url,
                    }
                )
                existing_urls.add(image_url)
        images.sort(key=lambda item: _parse_iso(item.get("updated_at")), reverse=True)
        return images

    @staticmethod
    def _build_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(rows)
        running = len([r for r in rows if r["status"] == "RUNNING"])
        success = len([r for r in rows if r["status"] == "SUCCESS"])
        failed = len([r for r in rows if r["status"] == "FAILED"])
        queued = total - running - success - failed
        return {
            "total": total,
            "queued": queued,
            "running": running,
            "success": success,
            "failed": failed,
        }


def create_app(*, base_url: str, access_code: str = "") -> Flask:
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    aggregator = DashboardAggregator(base_url=base_url, access_code=access_code)

    @app.get("/")
    def index() -> Any:
        return send_from_directory(STATIC_DIR, "index.html")

    @app.get("/api/dashboard/health")
    def health() -> Any:
        return jsonify({"ok": True, "time": _now_iso()})

    @app.get("/api/dashboard/snapshot")
    def snapshot() -> Any:
        return jsonify(aggregator.build_snapshot())

    @app.get("/media/<project_id>/<filename>")
    def media(project_id: str, filename: str) -> Any:
        file_dir = UPLOADS_DIR / project_id / "pages"
        return send_from_directory(str(file_dir), filename)

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dynamic Web dashboard for Banana batch runs")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--base-url", default="http://localhost:5461")
    parser.add_argument("--access-code", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app = create_app(base_url=args.base_url, access_code=args.access_code)
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
