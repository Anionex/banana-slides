"""Batch workflow execution logic for run jobs."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urljoin

from ..errors import TaskError, TimeoutError
from ..http_client import APIClient
from ..models import ArtifactRecord, JobSpec, TaskRecord


def _emit_progress(
    progress_callback: Callable[[dict[str, Any]], None] | None,
    payload: dict[str, Any],
) -> None:
    if progress_callback is None:
        return
    try:
        progress_callback(payload)
    except Exception:  # noqa: BLE001
        # Monitoring must never break the main workflow.
        return


def wait_task(
    api: APIClient,
    project_id: str,
    task_id: str,
    *,
    timeout_sec: int,
    poll_interval: int,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    start = time.monotonic()
    while True:
        payload = api.get(f"/api/projects/{project_id}/tasks/{task_id}")
        data = payload.get("data", {})
        status = data.get("status")
        progress = data.get("progress") or {}

        _emit_progress(
            progress_callback,
            {
                "event": "task_polled",
                "project_id": project_id,
                "task_id": task_id,
                "task_type": data.get("task_type"),
                "status": status,
                "progress": progress,
            },
        )

        if status == "COMPLETED":
            _emit_progress(
                progress_callback,
                {
                    "event": "task_completed",
                    "project_id": project_id,
                    "task_id": task_id,
                    "task_type": data.get("task_type"),
                    "status": status,
                    "progress": progress,
                },
            )
            return data
        if status == "FAILED":
            _emit_progress(
                progress_callback,
                {
                    "event": "task_failed",
                    "project_id": project_id,
                    "task_id": task_id,
                    "task_type": data.get("task_type"),
                    "status": status,
                    "progress": progress,
                    "error_message": data.get("error_message"),
                },
            )
            raise TaskError(
                f"Task {task_id} failed",
                details={
                    "project_id": project_id,
                    "task_id": task_id,
                    "error_message": data.get("error_message"),
                    "progress": data.get("progress"),
                },
            )

        elapsed = time.monotonic() - start
        if elapsed >= timeout_sec:
            raise TimeoutError(
                f"Task timeout after {timeout_sec}s",
                details={"project_id": project_id, "task_id": task_id, "last_status": status},
            )

        time.sleep(poll_interval)


def wait_reference_parse(
    api: APIClient,
    file_id: str,
    *,
    timeout_sec: int,
    poll_interval: int,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    start = time.monotonic()
    while True:
        payload = api.get(f"/api/reference-files/{file_id}")
        file_data = payload.get("data", {}).get("file", {})
        status = file_data.get("parse_status")

        _emit_progress(
            progress_callback,
            {
                "event": "reference_parse_polled",
                "file_id": file_id,
                "status": status,
            },
        )

        if status == "completed":
            return file_data
        if status == "failed":
            raise TaskError(
                f"Reference file parse failed: {file_id}",
                details={"file_id": file_id, "error_message": file_data.get("error_message")},
            )

        elapsed = time.monotonic() - start
        if elapsed >= timeout_sec:
            raise TimeoutError(
                f"Reference file parse timeout after {timeout_sec}s",
                details={"file_id": file_id, "last_status": status},
            )

        time.sleep(poll_interval)


def execute_full_generation(
    api: APIClient,
    job: JobSpec,
    *,
    timeout_sec: int,
    poll_interval: int,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    if job.creation_type is None:
        raise ValueError("creation_type is required for full_generation")

    tasks: list[TaskRecord] = []
    artifacts: list[ArtifactRecord] = []

    create_payload: dict[str, Any] = {"creation_type": job.creation_type}
    if job.creation_type == "idea":
        create_payload["idea_prompt"] = job.idea_prompt
    elif job.creation_type == "outline":
        create_payload["outline_text"] = job.outline_text
    elif job.creation_type == "descriptions":
        create_payload["description_text"] = job.description_text

    project_resp = api.post("/api/projects", json_data=create_payload)
    project_id = project_resp.get("data", {}).get("project_id")
    if not project_id:
        raise TaskError("Create project response missing project_id", details=project_resp)
    _emit_progress(
        progress_callback,
        {
            "event": "project_created",
            "project_id": project_id,
            "stage": "PROJECT_CREATED",
        },
    )

    update_payload: dict[str, Any] = {}
    if job.template_style:
        update_payload["template_style"] = job.template_style
    if job.extra_requirements:
        update_payload["extra_requirements"] = job.extra_requirements
    if update_payload:
        api.put(f"/api/projects/{project_id}", json_data=update_payload)

    if job.template_image_path:
        path = Path(job.template_image_path)
        with path.open("rb") as f:
            api.post(
                f"/api/projects/{project_id}/template",
                files={"template_image": (path.name, f)},
            )

    for file_path in job.reference_files:
        ref_path = Path(file_path)
        with ref_path.open("rb") as f:
            upload_resp = api.post(
                "/api/reference-files/upload",
                form_data={"project_id": project_id},
                files={"file": (ref_path.name, f)},
            )
        file_id = upload_resp.get("data", {}).get("file", {}).get("id")
        if not file_id:
            raise TaskError("Reference upload response missing file id", details=upload_resp)
        api.post(f"/api/reference-files/{file_id}/parse")
        wait_reference_parse(
            api,
            file_id,
            timeout_sec=timeout_sec,
            poll_interval=poll_interval,
            progress_callback=progress_callback,
        )

    for mat_path_str in job.material_files:
        mat_path = Path(mat_path_str)
        with mat_path.open("rb") as f:
            api.post(
                f"/api/projects/{project_id}/materials/upload",
                files={"file": (mat_path.name, f)},
            )

    language_payload = {"language": job.language} if job.language else {}

    if job.creation_type == "descriptions":
        from_desc_body: dict[str, Any] = {}
        if job.language:
            from_desc_body["language"] = job.language
        _emit_progress(
            progress_callback,
            {
                "event": "stage_changed",
                "project_id": project_id,
                "stage": "GENERATE_FROM_DESCRIPTION",
            },
        )
        api.post(f"/api/projects/{project_id}/generate/from-description", json_data=from_desc_body)
    else:
        _emit_progress(
            progress_callback,
            {
                "event": "stage_changed",
                "project_id": project_id,
                "stage": "GENERATE_OUTLINE",
            },
        )
        outline_body: dict[str, Any] = {}
        if job.language:
            outline_body["language"] = job.language
        api.post(f"/api/projects/{project_id}/generate/outline", json_data=outline_body)

        desc_body: dict[str, Any] = dict(language_payload)
        if job.max_description_workers is not None:
            desc_body["max_workers"] = job.max_description_workers

        desc_resp = api.post(f"/api/projects/{project_id}/generate/descriptions", json_data=desc_body)
        desc_task_id = desc_resp.get("data", {}).get("task_id")
        if not desc_task_id:
            raise TaskError("Generate descriptions response missing task_id", details=desc_resp)
        _emit_progress(
            progress_callback,
            {
                "event": "task_started",
                "project_id": project_id,
                "task_id": desc_task_id,
                "task_type": "GENERATE_DESCRIPTIONS",
                "stage": "GENERATE_DESCRIPTIONS",
            },
        )
        wait_task(
            api,
            project_id,
            desc_task_id,
            timeout_sec=timeout_sec,
            poll_interval=poll_interval,
            progress_callback=progress_callback,
        )
        tasks.append(TaskRecord(task_id=desc_task_id, type="GENERATE_DESCRIPTIONS", status="COMPLETED"))

    image_body: dict[str, Any] = dict(language_payload)
    image_body["use_template"] = job.use_template
    if job.max_image_workers is not None:
        image_body["max_workers"] = job.max_image_workers

    image_resp = api.post(f"/api/projects/{project_id}/generate/images", json_data=image_body)
    image_task_id = image_resp.get("data", {}).get("task_id")
    if not image_task_id:
        raise TaskError("Generate images response missing task_id", details=image_resp)
    _emit_progress(
        progress_callback,
        {
            "event": "task_started",
            "project_id": project_id,
            "task_id": image_task_id,
            "task_type": "GENERATE_IMAGES",
            "stage": "GENERATE_IMAGES",
        },
    )
    wait_task(
        api,
        project_id,
        image_task_id,
        timeout_sec=timeout_sec,
        poll_interval=poll_interval,
        progress_callback=progress_callback,
    )
    tasks.append(TaskRecord(task_id=image_task_id, type="GENERATE_IMAGES", status="COMPLETED"))

    _emit_progress(
        progress_callback,
        {
            "event": "stage_changed",
            "project_id": project_id,
            "stage": "EXPORTING",
        },
    )
    artifacts.extend(
        execute_exports(
            api,
            project_id,
            job,
            timeout_sec=timeout_sec,
            poll_interval=poll_interval,
            tasks=tasks,
            progress_callback=progress_callback,
        )
    )

    return {
        "project_id": project_id,
        "tasks": tasks,
        "artifacts": artifacts,
    }


def execute_export_only(
    api: APIClient,
    job: JobSpec,
    *,
    timeout_sec: int,
    poll_interval: int,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    if not job.project_id:
        raise ValueError("project_id required for export_only")

    tasks: list[TaskRecord] = []
    artifacts = execute_exports(
        api,
        job.project_id,
        job,
        timeout_sec=timeout_sec,
        poll_interval=poll_interval,
        tasks=tasks,
        progress_callback=progress_callback,
    )

    return {
        "project_id": job.project_id,
        "tasks": tasks,
        "artifacts": artifacts,
    }


def execute_exports(
    api: APIClient,
    project_id: str,
    job: JobSpec,
    *,
    timeout_sec: int,
    poll_interval: int,
    tasks: list[TaskRecord],
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> list[ArtifactRecord]:
    artifacts: list[ArtifactRecord] = []
    page_ids_param = ",".join(job.export.page_ids) if job.export.page_ids else None

    for fmt in job.export.formats:
        if fmt in {"pptx", "pdf", "images"}:
            params: dict[str, Any] = {}
            if page_ids_param:
                params["page_ids"] = page_ids_param

            if fmt in {"pptx", "pdf"} and job.export.filename_prefix:
                ext = "pptx" if fmt == "pptx" else "pdf"
                params["filename"] = f"{job.export.filename_prefix}.{ext}"

            resp = api.get(f"/api/projects/{project_id}/export/{fmt}", params=params)
            data = resp.get("data", {})
            url = data.get("download_url_absolute") or _absolutize(api, data.get("download_url", ""))
            artifacts.append(ArtifactRecord(format=fmt, download_url=url))
            _emit_progress(
                progress_callback,
                {
                    "event": "artifact_ready",
                    "project_id": project_id,
                    "format": fmt,
                    "download_url": url,
                },
            )
            continue

        if fmt == "editable_pptx":
            body: dict[str, Any] = {
                "max_depth": job.export.editable_max_depth,
                "max_workers": job.export.editable_max_workers,
            }
            if job.export.page_ids:
                body["page_ids"] = job.export.page_ids
            if job.export.filename_prefix:
                body["filename"] = f"{job.export.filename_prefix}_editable.pptx"

            export_resp = api.post(f"/api/projects/{project_id}/export/editable-pptx", json_data=body)
            task_id = export_resp.get("data", {}).get("task_id")
            if not task_id:
                raise TaskError("Editable export response missing task_id", details=export_resp)
            _emit_progress(
                progress_callback,
                {
                    "event": "task_started",
                    "project_id": project_id,
                    "task_id": task_id,
                    "task_type": "EXPORT_EDITABLE_PPTX",
                    "stage": "EXPORT_EDITABLE_PPTX",
                },
            )

            final_task = wait_task(
                api,
                project_id,
                task_id,
                timeout_sec=timeout_sec,
                poll_interval=poll_interval,
                progress_callback=progress_callback,
            )
            tasks.append(TaskRecord(task_id=task_id, type="EXPORT_EDITABLE_PPTX", status="COMPLETED"))

            progress = final_task.get("progress") or {}
            dl = progress.get("download_url")
            if not dl:
                raise TaskError("Editable export completed without download_url", details=final_task)
            abs_url = _absolutize(api, dl)
            artifacts.append(ArtifactRecord(format="editable_pptx", download_url=abs_url))
            _emit_progress(
                progress_callback,
                {
                    "event": "artifact_ready",
                    "project_id": project_id,
                    "format": "editable_pptx",
                    "download_url": abs_url,
                },
            )
            continue

        raise TaskError(f"Unsupported export format: {fmt}")

    return artifacts


def _absolutize(api: APIClient, url: str) -> str:
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return urljoin(api.config.base_url + "/", url.lstrip("/"))
