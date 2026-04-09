"""Workflow commands."""

from __future__ import annotations

from typing import Optional

import click
import typer

from ..jobs.workflow import wait_task
from ..output import cli_command, emit_output
from ..resolve import resolve_project_id
from ..state import state
from .common import parse_list_csv

app = typer.Typer(no_args_is_help=True)


def _do_outline(
    project_id: str,
    from_description: bool = False,
    refine: str | None = None,
    language: str | None = None,
    pages: int | None = None,
) -> dict:
    payload: dict = {}
    if language:
        payload["language"] = language
    if pages is not None:
        payload["outline_requirements"] = f"Generate exactly {pages} pages."
    if refine:
        payload["user_requirement"] = refine
        return state.api.post(f"/api/projects/{project_id}/refine/outline", json_data=payload)
    if from_description:
        return state.api.post(f"/api/projects/{project_id}/generate/from-description", json_data=payload)
    return state.api.post(f"/api/projects/{project_id}/generate/outline", json_data=payload)


@app.command("outline")
@cli_command
def workflows_outline(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    from_description: bool = typer.Option(False, help="Generate from description"),
    refine: Optional[str] = typer.Option(None, help="Refine with user requirement"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(["zh", "en", "ja", "auto"])),
    pages: Optional[int] = typer.Option(None, help="Target number of pages"),
) -> None:
    """Generate or refine outline."""
    project_id = resolve_project_id(project_id)
    emit_output(_do_outline(project_id, from_description, refine, language, pages))


@app.command("descriptions")
@cli_command
def workflows_descriptions(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    refine: Optional[str] = typer.Option(None, help="Refine with user requirement"),
    max_workers: Optional[int] = typer.Option(None, help="Max workers"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(["zh", "en", "ja", "auto"])),
    wait: bool = typer.Option(False, help="Wait for task completion"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Generate or refine descriptions."""
    project_id = resolve_project_id(project_id)
    payload: dict = {}
    if max_workers is not None:
        payload["max_workers"] = max_workers
    if language:
        payload["language"] = language

    if refine:
        payload["user_requirement"] = refine
        emit_output(state.api.post(f"/api/projects/{project_id}/refine/descriptions", json_data=payload))
        return

    resp = state.api.post(f"/api/projects/{project_id}/generate/descriptions", json_data=payload)
    if wait:
        task_id = resp.get("data", {}).get("task_id")
        if task_id:
            final = wait_task(state.api, project_id, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)
            emit_output({"success": True, "data": {"task": final, "task_id": task_id}})
            return
    emit_output(resp)


@app.command("images")
@cli_command
def workflows_images(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    max_workers: Optional[int] = typer.Option(None, help="Max workers"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(["zh", "en", "ja", "auto"])),
    page_ids: Optional[str] = typer.Option(None, help="Comma-separated page IDs"),
    wait: bool = typer.Option(False, help="Wait for task completion"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
    use_template: bool = typer.Option(True, "--use-template/--no-template", help="Use template"),
) -> None:
    """Generate images."""
    project_id = resolve_project_id(project_id)
    payload: dict = {"use_template": use_template}
    if max_workers is not None:
        payload["max_workers"] = max_workers
    if language:
        payload["language"] = language
    ids = parse_list_csv(page_ids)
    if ids:
        payload["page_ids"] = ids

    resp = state.api.post(f"/api/projects/{project_id}/generate/images", json_data=payload)
    if wait:
        task_id = resp.get("data", {}).get("task_id")
        if task_id:
            final = wait_task(state.api, project_id, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)
            emit_output({"success": True, "data": {"task": final, "task_id": task_id}})
            return
    emit_output(resp)


@app.command("full")
@cli_command
def workflows_full(
    project_id: Optional[str] = typer.Option(None, help="Project ID or prefix"),
    from_description: bool = typer.Option(False, help="Generate from description"),
    skip_outline: bool = typer.Option(False, help="Skip outline generation"),
    skip_descriptions: bool = typer.Option(False, help="Skip descriptions generation"),
    skip_images: bool = typer.Option(False, help="Skip images generation"),
    language: Optional[str] = typer.Option(None, help="Language", click_type=click.Choice(["zh", "en", "ja", "auto"])),
    pages: Optional[int] = typer.Option(None, help="Target number of pages"),
    desc_max_workers: Optional[int] = typer.Option(None, help="Description max workers"),
    image_max_workers: Optional[int] = typer.Option(None, help="Image max workers"),
    use_template: bool = typer.Option(True, "--use-template/--no-template", help="Use template"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Run outline -> descriptions -> images pipeline."""
    project_id = resolve_project_id(project_id)
    tasks = []
    cfg = state.config

    if not skip_outline:
        _do_outline(project_id, from_description, language=language, pages=pages)

    if not skip_descriptions:
        desc_payload: dict = {}
        if desc_max_workers is not None:
            desc_payload["max_workers"] = desc_max_workers
        if language:
            desc_payload["language"] = language
        desc_resp = state.api.post(f"/api/projects/{project_id}/generate/descriptions", json_data=desc_payload)
        desc_task_id = desc_resp.get("data", {}).get("task_id")
        if desc_task_id:
            final_desc = wait_task(state.api, project_id, desc_task_id, timeout_sec=timeout_sec, poll_interval=cfg.poll_interval)
            tasks.append({"task_id": desc_task_id, "task": final_desc})

    if not skip_images:
        img_payload: dict = {"use_template": use_template}
        if image_max_workers is not None:
            img_payload["max_workers"] = image_max_workers
        if language:
            img_payload["language"] = language
        img_resp = state.api.post(f"/api/projects/{project_id}/generate/images", json_data=img_payload)
        img_task_id = img_resp.get("data", {}).get("task_id")
        if img_task_id:
            final_img = wait_task(state.api, project_id, img_task_id, timeout_sec=timeout_sec, poll_interval=cfg.poll_interval)
            tasks.append({"task_id": img_task_id, "task": final_img})

    emit_output({"success": True, "data": {"project_id": project_id, "tasks": tasks}})
