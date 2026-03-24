"""Material commands."""

from __future__ import annotations

import argparse
from pathlib import Path

from ..http_client import APIClient
from ..jobs.workflow import wait_task
from .common import ensure_file


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("materials", help="Material operations")
    child = parser.add_subparsers(dest="materials_action", required=True)

    p_list = child.add_parser("list", help="List materials")
    p_list.add_argument("--project-id")
    p_list.add_argument("--scope", choices=["all", "none"], default="all")
    p_list.set_defaults(handler=cmd_list)

    p_upload = child.add_parser("upload", help="Upload material")
    p_upload.add_argument("--file", required=True)
    p_upload.add_argument("--project-id")
    p_upload.add_argument("--global", dest="is_global", action="store_true")
    p_upload.set_defaults(handler=cmd_upload)

    p_gen = child.add_parser("generate", help="Generate material image")
    p_gen.add_argument("--prompt", required=True)
    p_gen.add_argument("--project-id")
    p_gen.add_argument("--global", dest="is_global", action="store_true")
    p_gen.add_argument("--ref-image")
    p_gen.add_argument("--extra-image", action="append", default=[])
    p_gen.add_argument("--wait", action="store_true")
    p_gen.add_argument("--timeout-sec", type=int, default=1800)
    p_gen.set_defaults(handler=cmd_generate)

    p_assoc = child.add_parser("associate", help="Associate global materials to project")
    p_assoc.add_argument("--project-id", required=True)
    p_assoc.add_argument("--material-url", action="append", required=True)
    p_assoc.set_defaults(handler=cmd_associate)

    p_download = child.add_parser("download", help="Download materials zip")
    p_download.add_argument("--material-id", action="append", required=True)
    p_download.add_argument("--output", required=True)
    p_download.set_defaults(handler=cmd_download)

    p_delete = child.add_parser("delete", help="Delete material")
    p_delete.add_argument("--material-id", required=True)
    p_delete.set_defaults(handler=cmd_delete)


def cmd_list(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    if args.project_id:
        return api.get(f"/api/projects/{args.project_id}/materials")
    return api.get("/api/materials", params={"project_id": args.scope})


def cmd_upload(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    path = ensure_file(args.file)
    with path.open("rb") as f:
        if args.is_global or not args.project_id:
            return api.post("/api/materials/upload", files={"file": (path.name, f)})
        return api.post(f"/api/projects/{args.project_id}/materials/upload", files={"file": (path.name, f)})


def cmd_generate(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    endpoint_project = args.project_id if args.project_id and not args.is_global else "none"

    form = {"prompt": args.prompt}
    files = []
    opened = []

    try:
        if args.ref_image:
            ref = ensure_file(args.ref_image)
            rf = ref.open("rb")
            opened.append(rf)
            files.append(("ref_image", (ref.name, rf)))

        for p in args.extra_image:
            img = ensure_file(p)
            f = img.open("rb")
            opened.append(f)
            files.append(("extra_images", (img.name, f)))

        resp = api.post(f"/api/projects/{endpoint_project}/materials/generate", form_data=form, files=files)

        if args.wait:
            task_id = resp.get("data", {}).get("task_id")
            if task_id:
                task_project = args.project_id if args.project_id and not args.is_global else "global"
                final = wait_task(
                    api,
                    task_project,
                    task_id,
                    timeout_sec=args.timeout_sec,
                    poll_interval=cfg.poll_interval,
                )
                return {"success": True, "data": {"task_id": task_id, "task": final}}
        return resp
    finally:
        for f in opened:
            f.close()


def cmd_associate(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.post(
        "/api/materials/associate",
        json_data={"project_id": args.project_id, "material_urls": args.material_url},
    )


def cmd_download(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    response = api.request(
        "POST",
        "/api/materials/download",
        json_data={"material_ids": args.material_id},
        raw=True,
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(response.content)
    return {
        "success": True,
        "data": {
            "output_path": str(output.resolve()),
            "size_bytes": len(response.content),
        },
    }


def cmd_delete(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.delete(f"/api/materials/{args.material_id}")
