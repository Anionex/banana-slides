"""Export commands."""

from __future__ import annotations

from typing import Optional
from urllib.parse import urljoin

import typer

from ..jobs.workflow import wait_task
from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state
from .common import parse_list_csv

app = typer.Typer(no_args_is_help=True)


def _basic_export(project_id: str, export_type: str, filename: str | None, page_ids: str | None) -> None:
    params: dict = {}
    if filename:
        params["filename"] = filename
    ids = parse_list_csv(page_ids)
    if ids:
        params["page_ids"] = ",".join(ids)
    emit_output(state.api.get(f"/api/projects/{project_id}/export/{export_type}", params=params))


@app.command("pptx")
@cli_command
def exports_pptx(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Output filename"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
) -> None:
    """Export PPTX."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "pptx", filename, page_ids)


@app.command("pdf")
@cli_command
def exports_pdf(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Output filename"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
) -> None:
    """Export PDF."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "pdf", filename, page_ids)


@app.command("images")
@cli_command
def exports_images(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Output filename"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
) -> None:
    """Export images."""
    project_id = resolve_project_id(project_id)
    _basic_export(project_id, "images", filename, page_ids)


@app.command("editable-pptx")
@cli_command
def exports_editable_pptx(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    filename: Optional[str] = typer.Option(None, help="Output filename"),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    max_depth: int = typer.Option(1, help="Max extraction depth"),
    max_workers: int = typer.Option(4, help="Max workers"),
    wait: bool = typer.Option(False, help="Wait for task completion"),
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

    task_data = wait_task(state.api, project_id, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)

    progress = task_data.get("progress") or {}
    dl = progress.get("download_url")
    if dl and not dl.startswith(("http://", "https://")):
        dl = urljoin(state.api.config.base_url + "/", dl.lstrip("/"))

    emit_output({"success": True, "data": {"task_id": task_id, "task": task_data, "download_url": dl}})
