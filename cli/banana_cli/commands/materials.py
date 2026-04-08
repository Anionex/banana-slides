"""Material commands."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import typer

from ..jobs.workflow import wait_task
from ..output import cli_command, emit_output
from ..state import state
from .common import ensure_file

app = typer.Typer(no_args_is_help=True)


@app.command("list")
@cli_command
def materials_list(
    project_id: Optional[str] = typer.Option(None, help="Project ID"),
    scope: str = typer.Option("all", help="Scope: all or none"),
) -> None:
    """List materials."""
    if project_id:
        emit_output(state.api.get(f"/api/projects/{project_id}/materials"))
    else:
        emit_output(state.api.get("/api/materials", params={"project_id": scope}))


@app.command("upload")
@cli_command
def materials_upload(
    file: str = typer.Option(..., help="Absolute file path"),
    project_id: Optional[str] = typer.Option(None, help="Project ID"),
    is_global: bool = typer.Option(False, "--global", help="Upload as global material"),
) -> None:
    """Upload material."""
    path = ensure_file(file)
    with path.open("rb") as f:
        if is_global or not project_id:
            emit_output(state.api.post("/api/materials/upload", files={"file": (path.name, f)}))
        else:
            emit_output(state.api.post(f"/api/projects/{project_id}/materials/upload", files={"file": (path.name, f)}))


@app.command("generate")
@cli_command
def materials_generate(
    prompt: str = typer.Option(..., help="Generation prompt"),
    project_id: Optional[str] = typer.Option(None, help="Project ID"),
    is_global: bool = typer.Option(False, "--global", help="Generate as global material"),
    ref_image: Optional[str] = typer.Option(None, help="Reference image path"),
    extra_image: Optional[List[str]] = typer.Option(None, help="Extra image paths"),
    wait: bool = typer.Option(False, help="Wait for task completion"),
    timeout_sec: int = typer.Option(1800, help="Task timeout seconds"),
) -> None:
    """Generate material image."""
    endpoint_project = project_id if project_id and not is_global else "none"
    form = {"prompt": prompt}
    files = []
    opened = []

    try:
        if ref_image:
            ref = ensure_file(ref_image)
            rf = ref.open("rb")
            opened.append(rf)
            files.append(("ref_image", (ref.name, rf)))

        for p in (extra_image or []):
            img = ensure_file(p)
            f = img.open("rb")
            opened.append(f)
            files.append(("extra_images", (img.name, f)))

        resp = state.api.post(f"/api/projects/{endpoint_project}/materials/generate", form_data=form, files=files)

        if wait:
            task_id = resp.get("data", {}).get("task_id")
            if task_id:
                task_project = project_id if project_id and not is_global else "global"
                final = wait_task(state.api, task_project, task_id, timeout_sec=timeout_sec, poll_interval=state.config.poll_interval)
                emit_output({"success": True, "data": {"task_id": task_id, "task": final}})
                return
        emit_output(resp)
    finally:
        for f in opened:
            f.close()


@app.command("associate")
@cli_command
def materials_associate(
    project_id: str = typer.Option(..., help="Project ID"),
    material_url: List[str] = typer.Option(..., help="Material URLs"),
) -> None:
    """Associate global materials to project."""
    emit_output(
        state.api.post("/api/materials/associate", json_data={"project_id": project_id, "material_urls": material_url})
    )


@app.command("download")
@cli_command
def materials_download(
    material_id: List[str] = typer.Option(..., help="Material IDs"),
    output: str = typer.Option(..., help="Output file path"),
) -> None:
    """Download materials zip."""
    response = state.api.request("POST", "/api/materials/download", json_data={"material_ids": material_id}, raw=True)
    out = Path(output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(response.content)
    emit_output({"success": True, "data": {"output_path": str(out.resolve()), "size_bytes": len(response.content)}})


@app.command("delete")
@cli_command
def materials_delete(
    material_id: str = typer.Option(..., help="Material ID"),
) -> None:
    """Delete material."""
    emit_output(state.api.delete(f"/api/materials/{material_id}"))
