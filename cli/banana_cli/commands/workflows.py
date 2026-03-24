"""Workflow commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from ..jobs.workflow import wait_task
from .common import parse_list_csv


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("workflows", help="Workflow operations")
    child = parser.add_subparsers(dest="workflows_action", required=True)

    p_outline = child.add_parser("outline", help="Generate or refine outline")
    p_outline.add_argument("--project-id", required=True)
    p_outline.add_argument("--from-description", action="store_true")
    p_outline.add_argument("--refine")
    p_outline.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_outline.set_defaults(handler=cmd_outline)

    p_desc = child.add_parser("descriptions", help="Generate or refine descriptions")
    p_desc.add_argument("--project-id", required=True)
    p_desc.add_argument("--refine")
    p_desc.add_argument("--max-workers", type=int)
    p_desc.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_desc.add_argument("--wait", action="store_true")
    p_desc.add_argument("--timeout-sec", type=int, default=1800)
    p_desc.set_defaults(handler=cmd_descriptions)

    p_images = child.add_parser("images", help="Generate images")
    p_images.add_argument("--project-id", required=True)
    p_images.add_argument("--max-workers", type=int)
    p_images.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_images.add_argument("--page-ids", help="Comma-separated page IDs")
    p_images.add_argument("--wait", action="store_true")
    p_images.add_argument("--timeout-sec", type=int, default=1800)
    p_images.add_argument("--use-template", dest="use_template", action="store_true", default=True)
    p_images.add_argument("--no-template", dest="use_template", action="store_false")
    p_images.set_defaults(handler=cmd_images)

    p_full = child.add_parser("full", help="Run outline -> descriptions -> images")
    p_full.add_argument("--project-id", required=True)
    p_full.add_argument("--from-description", action="store_true")
    p_full.add_argument("--skip-outline", action="store_true")
    p_full.add_argument("--skip-descriptions", action="store_true")
    p_full.add_argument("--skip-images", action="store_true")
    p_full.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_full.add_argument("--desc-max-workers", type=int)
    p_full.add_argument("--image-max-workers", type=int)
    p_full.add_argument("--use-template", dest="use_template", action="store_true", default=True)
    p_full.add_argument("--no-template", dest="use_template", action="store_false")
    p_full.add_argument("--timeout-sec", type=int, default=1800)
    p_full.set_defaults(handler=cmd_full)


def cmd_outline(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = {}
    if args.language:
        payload["language"] = args.language

    if args.refine:
        payload["user_requirement"] = args.refine
        return api.post(f"/api/projects/{args.project_id}/refine/outline", json_data=payload)

    if args.from_description:
        return api.post(f"/api/projects/{args.project_id}/generate/from-description", json_data=payload)

    return api.post(f"/api/projects/{args.project_id}/generate/outline", json_data=payload)


def cmd_descriptions(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    payload = {}
    if args.max_workers is not None:
        payload["max_workers"] = args.max_workers
    if args.language:
        payload["language"] = args.language

    if args.refine:
        payload["user_requirement"] = args.refine
        return api.post(f"/api/projects/{args.project_id}/refine/descriptions", json_data=payload)

    resp = api.post(f"/api/projects/{args.project_id}/generate/descriptions", json_data=payload)
    if args.wait:
        task_id = resp.get("data", {}).get("task_id")
        if task_id:
            final = wait_task(
                api,
                args.project_id,
                task_id,
                timeout_sec=args.timeout_sec,
                poll_interval=cfg.poll_interval,
            )
            return {"success": True, "data": {"task": final, "task_id": task_id}}
    return resp


def cmd_images(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    payload = {"use_template": args.use_template}
    if args.max_workers is not None:
        payload["max_workers"] = args.max_workers
    if args.language:
        payload["language"] = args.language
    page_ids = parse_list_csv(args.page_ids)
    if page_ids:
        payload["page_ids"] = page_ids

    resp = api.post(f"/api/projects/{args.project_id}/generate/images", json_data=payload)
    if args.wait:
        task_id = resp.get("data", {}).get("task_id")
        if task_id:
            final = wait_task(
                api,
                args.project_id,
                task_id,
                timeout_sec=args.timeout_sec,
                poll_interval=cfg.poll_interval,
            )
            return {"success": True, "data": {"task": final, "task_id": task_id}}
    return resp


def cmd_full(api: APIClient, cfg, args: argparse.Namespace) -> dict:
    tasks = []

    if not args.skip_outline:
        cmd_outline(api, cfg, argparse.Namespace(
            project_id=args.project_id,
            from_description=args.from_description,
            refine=None,
            language=args.language,
        ))

    if not args.skip_descriptions:
        desc_payload = {}
        if args.desc_max_workers is not None:
            desc_payload["max_workers"] = args.desc_max_workers
        if args.language:
            desc_payload["language"] = args.language
        desc_resp = api.post(f"/api/projects/{args.project_id}/generate/descriptions", json_data=desc_payload)
        desc_task_id = desc_resp.get("data", {}).get("task_id")
        if desc_task_id:
            final_desc = wait_task(
                api,
                args.project_id,
                desc_task_id,
                timeout_sec=args.timeout_sec,
                poll_interval=cfg.poll_interval,
            )
            tasks.append({"task_id": desc_task_id, "task": final_desc})

    if not args.skip_images:
        img_payload = {"use_template": args.use_template}
        if args.image_max_workers is not None:
            img_payload["max_workers"] = args.image_max_workers
        if args.language:
            img_payload["language"] = args.language
        img_resp = api.post(f"/api/projects/{args.project_id}/generate/images", json_data=img_payload)
        img_task_id = img_resp.get("data", {}).get("task_id")
        if img_task_id:
            final_img = wait_task(
                api,
                args.project_id,
                img_task_id,
                timeout_sec=args.timeout_sec,
                poll_interval=cfg.poll_interval,
            )
            tasks.append({"task_id": img_task_id, "task": final_img})

    return {"success": True, "data": {"project_id": args.project_id, "tasks": tasks}}
