"""Projects commands."""

from __future__ import annotations

import argparse

from ..http_client import APIClient
from .common import add_data_options, load_data_args


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("projects", help="Project operations")
    child = parser.add_subparsers(dest="projects_action", required=True)

    p_list = child.add_parser("list", help="List projects")
    p_list.add_argument("--limit", type=int, default=50)
    p_list.add_argument("--offset", type=int, default=0)
    p_list.set_defaults(handler=cmd_list)

    p_get = child.add_parser("get", help="Get project")
    p_get.add_argument("project_id")
    p_get.set_defaults(handler=cmd_get)

    p_create = child.add_parser("create", help="Create project")
    p_create.add_argument("--creation-type", choices=["idea", "outline", "descriptions"])
    p_create.add_argument("--idea-prompt")
    p_create.add_argument("--outline-text")
    p_create.add_argument("--description-text")
    p_create.add_argument("--template-style")
    p_create.add_argument("--extra-requirements")
    p_create.add_argument("--image-aspect-ratio")
    add_data_options(p_create)
    p_create.set_defaults(handler=cmd_create)

    p_update = child.add_parser("update", help="Update project")
    p_update.add_argument("project_id")
    p_update.add_argument("--idea-prompt")
    p_update.add_argument("--outline-text")
    p_update.add_argument("--description-text")
    p_update.add_argument("--template-style")
    p_update.add_argument("--extra-requirements")
    p_update.add_argument("--image-aspect-ratio")
    p_update.add_argument("--export-extractor-method")
    p_update.add_argument("--export-inpaint-method")
    add_data_options(p_update)
    p_update.set_defaults(handler=cmd_update)

    p_delete = child.add_parser("delete", help="Delete project")
    p_delete.add_argument("project_id")
    p_delete.set_defaults(handler=cmd_delete)


def cmd_list(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get("/api/projects", params={"limit": args.limit, "offset": args.offset})


def cmd_get(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/projects/{args.project_id}")


def cmd_create(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = load_data_args(args)
    if args.creation_type:
        payload.setdefault("creation_type", args.creation_type)
    if args.idea_prompt:
        payload.setdefault("idea_prompt", args.idea_prompt)
    if args.outline_text:
        payload.setdefault("outline_text", args.outline_text)
    if args.description_text:
        payload.setdefault("description_text", args.description_text)
    if args.template_style:
        payload.setdefault("template_style", args.template_style)
    if args.extra_requirements:
        payload.setdefault("extra_requirements", args.extra_requirements)
    if args.image_aspect_ratio:
        payload.setdefault("image_aspect_ratio", args.image_aspect_ratio)
    return api.post("/api/projects", json_data=payload)


def cmd_update(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = load_data_args(args)
    if args.idea_prompt:
        payload.setdefault("idea_prompt", args.idea_prompt)
    if args.outline_text:
        payload.setdefault("outline_text", args.outline_text)
    if args.description_text:
        payload.setdefault("description_text", args.description_text)
    if args.template_style:
        payload.setdefault("template_style", args.template_style)
    if args.extra_requirements:
        payload.setdefault("extra_requirements", args.extra_requirements)
    if args.image_aspect_ratio:
        payload.setdefault("image_aspect_ratio", args.image_aspect_ratio)
    if args.export_extractor_method:
        payload.setdefault("export_extractor_method", args.export_extractor_method)
    if args.export_inpaint_method:
        payload.setdefault("export_inpaint_method", args.export_inpaint_method)
    return api.put(f"/api/projects/{args.project_id}", json_data=payload)


def cmd_delete(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.delete(f"/api/projects/{args.project_id}")
