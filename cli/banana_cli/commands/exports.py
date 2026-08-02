"""Export commands."""

from __future__ import annotations

from typing import Optional
from urllib.parse import urljoin

import typer

from ..jobs.workflow import make_stderr_progress_cb, wait_task
from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state
from .common import parse_list_csv

app = typer.Typer(no_args_is_help=True)


def _resolve_download_url(resp: dict) -> str | None:
    """Extract absolute download URL from an export response."""
    data = resp.get("data", {})
    url = data.get("download_url_absolute") or data.get("download_url")
    if url and not url.startswith(("http://", "https://")):
        url = urljoin(state.api.config.base_url + "/", url.lstrip("/"))
    return url


def _basic_export(
    project_id: str,
    export_type: str,
    filename: str | None,
    page_ids: str | None,
    output: str | None,
) -> None:
    params: dict = {}
    if filename:
        params["filename"] = filename
    ids = parse_list_csv(page_ids)
    if ids:
        params["page_ids"] = ",".join(ids)
    resp = state.api.get(f"/api/projects/{project_id}/export/{export_type}", params=params)

    if output:
        url = _resolve_download_url(resp)
        if url:
            emit_output(state.api.download(url, output))
            return

    emit_output(resp)


@app.command("pptx")
@cli_command
def exports_pptx(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Server-side filename for the download URL"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    output: Optional[str] = typer.Option(None, help="Download to this local path"),
) -> None:
    """Export PPTX."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "pptx", filename, page_ids, output)


@app.command("pdf")
@cli_command
def exports_pdf(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Server-side filename for the download URL"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    output: Optional[str] = typer.Option(None, help="Download to this local path"),
) -> None:
    """Export PDF."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "pdf", filename, page_ids, output)


@app.command("images")
@cli_command
def exports_images(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Server-side filename for the download URL"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    output: Optional[str] = typer.Option(None, help="Download to this local path"),
) -> None:
    """Export images."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "images", filename, page_ids, output)


@app.command("editable-pptx")
@cli_command
def exports_editable_pptx(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Server-side filename for the download URL"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    output: Optional[str] = typer.Option(None, help="Download to this local path"),
    max_depth: int = typer.Option(1, help="Max extraction depth"),
    max_workers: int = typer.Option(4, help="Max workers"),
    wait: bool = typer.Option(True, "--wait/--no-wait", help="Wait for task completion (default: wait)"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Export editable PPTX asynchronously."""
    project_id = resolve_project_id(project_id)
    body: dict = {"max_depth": max_depth, "max_workers": max_workers}
    if filename:
        body["filename"] = filename
    ids = parse_list_csv(page_ids)
    if ids:
        body["page_ids"] = ids

    resp = state.api.post(f"/api/projects/{project_id}/export/editable-pptx", json_data=body)
    if not wait:
        emit_output(resp)
        return

    task_id = resp.get("data", {}).get("task_id")
    if not task_id:
        emit_output(resp)
        return

    task_data = wait_task(
        state.api, project_id, task_id,
        timeout_sec=timeout_sec,
        poll_interval=state.config.poll_interval,
        progress_callback=make_stderr_progress_cb(),
    )

    progress = task_data.get("progress") or {}
    dl = progress.get("download_url")
    if dl and not dl.startswith(("http://", "https://")):
        dl = urljoin(state.api.config.base_url + "/", dl.lstrip("/"))

    if output and dl:
        emit_output(state.api.download(dl, output))
        return

    emit_output({"success": True, "data": {"task_id": task_id, "task": task_data, "download_url": dl}})
