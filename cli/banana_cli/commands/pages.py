"""Page-level commands."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ..http_client import APIClient
from .common import ensure_file, parse_list_csv


def register(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("pages", help="Page operations")
    child = parser.add_subparsers(dest="pages_action", required=True)

    p_create = child.add_parser("create", help="Create page")
    p_create.add_argument("--project-id", required=True)
    p_create.add_argument("--order-index", type=int, required=True)
    p_create.add_argument("--part")
    p_create.add_argument("--outline-json")
    p_create.add_argument("--description-json")
    p_create.set_defaults(handler=cmd_create)

    p_update = child.add_parser("update", help="Update page base fields")
    p_update.add_argument("--project-id", required=True)
    p_update.add_argument("--page-id", required=True)
    p_update.add_argument("--part", required=True)
    p_update.set_defaults(handler=cmd_update)

    p_delete = child.add_parser("delete", help="Delete page")
    p_delete.add_argument("--project-id", required=True)
    p_delete.add_argument("--page-id", required=True)
    p_delete.set_defaults(handler=cmd_delete)

    p_outline = child.add_parser("set-outline", help="Set page outline content")
    p_outline.add_argument("--project-id", required=True)
    p_outline.add_argument("--page-id", required=True)
    p_outline.add_argument("--outline-json", required=True)
    p_outline.set_defaults(handler=cmd_set_outline)

    p_desc = child.add_parser("set-description", help="Set page description content")
    p_desc.add_argument("--project-id", required=True)
    p_desc.add_argument("--page-id", required=True)
    p_desc.add_argument("--description-json", required=True)
    p_desc.set_defaults(handler=cmd_set_description)

    p_gen_desc = child.add_parser("gen-description", help="Generate single page description")
    p_gen_desc.add_argument("--project-id", required=True)
    p_gen_desc.add_argument("--page-id", required=True)
    p_gen_desc.add_argument("--force-regenerate", action="store_true")
    p_gen_desc.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_gen_desc.set_defaults(handler=cmd_gen_description)

    p_gen_img = child.add_parser("gen-image", help="Generate single page image")
    p_gen_img.add_argument("--project-id", required=True)
    p_gen_img.add_argument("--page-id", required=True)
    p_gen_img.add_argument("--force-regenerate", action="store_true")
    p_gen_img.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_gen_img.add_argument("--use-template", dest="use_template", action="store_true", default=True)
    p_gen_img.add_argument("--no-template", dest="use_template", action="store_false")
    p_gen_img.set_defaults(handler=cmd_gen_image)

    p_edit = child.add_parser("edit-image", help="Edit single page image")
    p_edit.add_argument("--project-id", required=True)
    p_edit.add_argument("--page-id", required=True)
    p_edit.add_argument("--instruction", required=True)
    p_edit.add_argument("--use-template", dest="use_template", action="store_true", default=False)
    p_edit.add_argument("--desc-image-urls", help="Comma-separated image urls")
    p_edit.add_argument("--context-image", action="append", default=[])
    p_edit.set_defaults(handler=cmd_edit_image)

    p_versions = child.add_parser("versions", help="List page image versions")
    p_versions.add_argument("--project-id", required=True)
    p_versions.add_argument("--page-id", required=True)
    p_versions.set_defaults(handler=cmd_versions)

    p_set_current = child.add_parser("set-current", help="Set current image version")
    p_set_current.add_argument("--project-id", required=True)
    p_set_current.add_argument("--page-id", required=True)
    p_set_current.add_argument("--version-id", required=True)
    p_set_current.set_defaults(handler=cmd_set_current)

    p_regen = child.add_parser("regenerate-renovation", help="Regenerate renovation page")
    p_regen.add_argument("--project-id", required=True)
    p_regen.add_argument("--page-id", required=True)
    p_regen.add_argument("--language", choices=["zh", "en", "ja", "auto"])
    p_regen.add_argument("--keep-layout", action="store_true")
    p_regen.set_defaults(handler=cmd_regenerate_renovation)


def _parse_json(raw: str) -> dict:
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("JSON payload must be an object")
    return parsed


def cmd_create(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = {
        "order_index": args.order_index,
    }
    if args.part:
        payload["part"] = args.part
    if args.outline_json:
        payload["outline_content"] = _parse_json(args.outline_json)
    if args.description_json:
        payload["description_content"] = _parse_json(args.description_json)
    return api.post(f"/api/projects/{args.project_id}/pages", json_data=payload)


def cmd_update(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.put(
        f"/api/projects/{args.project_id}/pages/{args.page_id}",
        json_data={"part": args.part},
    )


def cmd_delete(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.delete(f"/api/projects/{args.project_id}/pages/{args.page_id}")


def cmd_set_outline(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.put(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/outline",
        json_data={"outline_content": _parse_json(args.outline_json)},
    )


def cmd_set_description(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.put(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/description",
        json_data={"description_content": _parse_json(args.description_json)},
    )


def cmd_gen_description(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = {"force_regenerate": args.force_regenerate}
    if args.language:
        payload["language"] = args.language
    return api.post(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/generate/description",
        json_data=payload,
    )


def cmd_gen_image(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = {
        "force_regenerate": args.force_regenerate,
        "use_template": args.use_template,
    }
    if args.language:
        payload["language"] = args.language
    return api.post(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/generate/image",
        json_data=payload,
    )


def cmd_edit_image(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    desc_urls = parse_list_csv(args.desc_image_urls)
    form_data = {
        "edit_instruction": args.instruction,
        "use_template": "true" if args.use_template else "false",
        "desc_image_urls": json.dumps(desc_urls),
    }

    files = []
    opened = []
    try:
        for path_str in args.context_image:
            path = ensure_file(path_str)
            f = path.open("rb")
            opened.append(f)
            files.append(("context_images", (path.name, f)))

        return api.post(
            f"/api/projects/{args.project_id}/pages/{args.page_id}/edit/image",
            form_data=form_data,
            files=files,
        )
    finally:
        for f in opened:
            f.close()


def cmd_versions(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.get(f"/api/projects/{args.project_id}/pages/{args.page_id}/image-versions")


def cmd_set_current(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    return api.post(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/image-versions/{args.version_id}/set-current"
    )


def cmd_regenerate_renovation(api: APIClient, _cfg, args: argparse.Namespace) -> dict:
    payload = {"keep_layout": args.keep_layout}
    if args.language:
        payload["language"] = args.language
    return api.post(
        f"/api/projects/{args.project_id}/pages/{args.page_id}/regenerate-renovation",
        json_data=payload,
    )
