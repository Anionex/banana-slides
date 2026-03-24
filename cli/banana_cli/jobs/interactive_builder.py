"""Interactive JSONL job builder for banana-cli."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable

from pydantic import ValidationError

from ..errors import InputError
from ..models import JobSpec

InputFn = Callable[[str], str]
PrintFn = Callable[[str], None]

JOB_TYPES = ("full_generation", "export_only")
CREATION_TYPES = ("idea", "outline", "descriptions")
LANGUAGES = ("zh", "en", "ja", "auto")
EXPORT_FORMATS = {"pptx", "pdf", "images", "editable_pptx"}


def _prompt(msg: str, input_fn: InputFn, default: str | None = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    raw = input_fn(f"{msg}{suffix}: ").strip()
    if not raw and default is not None:
        return default
    return raw


def _prompt_choice(
    msg: str,
    choices: tuple[str, ...] | list[str],
    input_fn: InputFn,
    print_fn: PrintFn,
    default: str | None = None,
) -> str:
    valid = set(choices)
    while True:
        value = _prompt(f"{msg} ({'/'.join(choices)})", input_fn, default=default).strip()
        if value in valid:
            return value
        print_fn(f"Invalid choice: {value}. Allowed: {', '.join(choices)}")


def _prompt_int(
    msg: str,
    input_fn: InputFn,
    print_fn: PrintFn,
    default: int | None = None,
    allow_empty: bool = True,
) -> int | None:
    default_raw = str(default) if default is not None else None
    while True:
        raw = _prompt(msg, input_fn, default=default_raw)
        if not raw:
            if allow_empty:
                return None
            print_fn("Value is required.")
            continue
        try:
            return int(raw)
        except ValueError:
            print_fn(f"Invalid integer: {raw}")


def _prompt_bool(msg: str, input_fn: InputFn, print_fn: PrintFn, default: bool = True) -> bool:
    default_raw = "y" if default else "n"
    while True:
        raw = _prompt(f"{msg} (y/n)", input_fn, default=default_raw).strip().lower()
        if raw in {"y", "yes"}:
            return True
        if raw in {"n", "no"}:
            return False
        print_fn(f"Invalid boolean value: {raw}")


def _parse_csv(raw: str) -> list[str]:
    chunks = [p.strip() for part in raw.split(";") for p in part.split(",")]
    return [c for c in chunks if c]


def _validate_abs_paths(paths: list[str]) -> list[str]:
    validated: list[str] = []
    for p in paths:
        path = Path(p)
        if not path.is_absolute():
            raise InputError(f"Path must be absolute: {p}")
        if not path.exists():
            raise InputError(f"Path not found: {p}")
        validated.append(str(path))
    return validated


def _prompt_optional_abs_path(msg: str, input_fn: InputFn, print_fn: PrintFn) -> str | None:
    while True:
        raw = _prompt(msg, input_fn, default="").strip()
        if not raw:
            return None
        try:
            return _validate_abs_paths([raw])[0]
        except InputError as exc:
            print_fn(exc.message)


def _prompt_optional_abs_paths(msg: str, input_fn: InputFn, print_fn: PrintFn) -> list[str]:
    while True:
        raw = _prompt(msg, input_fn, default="").strip()
        if not raw:
            return []
        try:
            return _validate_abs_paths(_parse_csv(raw))
        except InputError as exc:
            print_fn(exc.message)


def _prompt_export(input_fn: InputFn, print_fn: PrintFn) -> dict:
    while True:
        formats_raw = _prompt("Export formats (comma separated)", input_fn, default="pptx")
        formats = _parse_csv(formats_raw)
        invalid = [f for f in formats if f not in EXPORT_FORMATS]
        if not formats:
            print_fn("At least one export format is required.")
            continue
        if invalid:
            print_fn(f"Invalid formats: {', '.join(invalid)}")
            continue
        break

    filename_prefix = _prompt("Export filename prefix", input_fn, default="").strip() or None
    page_ids = _parse_csv(_prompt("Export page IDs (comma separated)", input_fn, default="").strip())
    editable_max_depth = _prompt_int(
        "Editable export max depth",
        input_fn,
        print_fn,
        default=1,
        allow_empty=False,
    )
    editable_max_workers = _prompt_int(
        "Editable export max workers",
        input_fn,
        print_fn,
        default=4,
        allow_empty=False,
    )

    return {
        "formats": formats,
        "filename_prefix": filename_prefix,
        "page_ids": page_ids,
        "editable_max_depth": editable_max_depth,
        "editable_max_workers": editable_max_workers,
    }


def _prompt_policy(input_fn: InputFn, print_fn: PrintFn) -> dict:
    continue_on_error = _prompt_bool("Continue on error", input_fn, print_fn, default=True)
    timeout_sec = _prompt_int("Task timeout (seconds)", input_fn, print_fn, default=1800, allow_empty=False)
    return {
        "continue_on_error": continue_on_error,
        "timeout_sec": timeout_sec,
    }


def prompt_job(index: int, input_fn: InputFn, print_fn: PrintFn) -> JobSpec:
    """Prompt and validate a single job spec."""
    while True:
        print_fn(f"--- Job {index} ---")
        payload: dict = {}

        job_id = _prompt("Job ID (optional)", input_fn, default="").strip() or None
        if job_id:
            payload["job_id"] = job_id

        job_type = _prompt_choice("Job type", JOB_TYPES, input_fn, print_fn, default="full_generation")
        payload["job_type"] = job_type

        if job_type == "full_generation":
            creation_type = _prompt_choice(
                "Creation type",
                CREATION_TYPES,
                input_fn,
                print_fn,
                default="idea",
            )
            payload["creation_type"] = creation_type

            if creation_type == "idea":
                payload["idea_prompt"] = _prompt("Idea prompt", input_fn, default="")
            elif creation_type == "outline":
                payload["outline_text"] = _prompt("Outline text", input_fn, default="")
            else:
                payload["description_text"] = _prompt("Description text", input_fn, default="")

            template_image = _prompt_optional_abs_path("Template image absolute path (optional)", input_fn, print_fn)
            if template_image:
                payload["template_image_path"] = template_image

            template_style = _prompt("Template style text (optional)", input_fn, default="").strip() or None
            if template_style:
                payload["template_style"] = template_style

            extra_requirements = _prompt("Extra requirements (optional)", input_fn, default="").strip() or None
            if extra_requirements:
                payload["extra_requirements"] = extra_requirements

            language = _prompt_choice("Language", LANGUAGES, input_fn, print_fn, default="zh")
            payload["language"] = language

            max_desc_workers = _prompt_int("Max description workers (optional)", input_fn, print_fn, default=None)
            if max_desc_workers is not None:
                payload["max_description_workers"] = max_desc_workers

            max_img_workers = _prompt_int("Max image workers (optional)", input_fn, print_fn, default=None)
            if max_img_workers is not None:
                payload["max_image_workers"] = max_img_workers

            payload["use_template"] = _prompt_bool("Use template when generating images", input_fn, print_fn, default=True)

            refs = _prompt_optional_abs_paths(
                "Reference files absolute paths (comma separated, optional)",
                input_fn,
                print_fn,
            )
            if refs:
                payload["reference_files"] = refs

            mats = _prompt_optional_abs_paths(
                "Material files absolute paths (comma separated, optional)",
                input_fn,
                print_fn,
            )
            if mats:
                payload["material_files"] = mats
        else:
            payload["project_id"] = _prompt("Project ID", input_fn, default="")

        payload["export"] = _prompt_export(input_fn, print_fn)
        payload["policy"] = _prompt_policy(input_fn, print_fn)

        try:
            return JobSpec.model_validate(payload)
        except ValidationError as exc:
            print_fn("Job validation failed, please re-enter this job.")
            print_fn(str(exc))


def interactive_generate(
    output_path: str | None = None,
    job_count: int | None = None,
    *,
    input_fn: InputFn = input,
    print_fn: PrintFn = print,
) -> Path:
    """Run interactive flow and write jobs to JSONL."""
    output_raw = output_path or _prompt("Output JSONL path", input_fn, default="./jobs.jsonl")
    out_path = Path(output_raw).expanduser()
    if not out_path.is_absolute():
        out_path = out_path.resolve()

    if out_path.exists():
        overwrite = _prompt_bool(f"File exists: {out_path}. Overwrite", input_fn, print_fn, default=False)
        if not overwrite:
            raise InputError("Output file already exists and overwrite was declined.")

    if job_count is None:
        count_val = _prompt_int("Number of jobs", input_fn, print_fn, default=1, allow_empty=False)
        if count_val is None or count_val <= 0:
            raise InputError("Job count must be > 0")
        job_count = count_val
    elif job_count <= 0:
        raise InputError("job_count must be > 0")

    jobs: list[JobSpec] = []
    for idx in range(1, job_count + 1):
        jobs.append(prompt_job(idx, input_fn, print_fn))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(job.model_dump(exclude_none=True), ensure_ascii=False)
        for job in jobs
    ]
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print_fn(f"Wrote {len(jobs)} jobs to: {out_path}")
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Interactive generator for banana-cli jobs JSONL")
    parser.add_argument("--output", help="Output JSONL path")
    parser.add_argument("--count", type=int, help="Number of jobs to prompt")
    args = parser.parse_args(argv)

    try:
        interactive_generate(output_path=args.output, job_count=args.count)
    except InputError as exc:
        print(json.dumps({"success": False, "error": exc.to_dict()}, ensure_ascii=False, indent=2))
        return 1
    except KeyboardInterrupt:
        print(json.dumps({"success": False, "error": {"code": "INTERRUPTED", "message": "Interrupted"}}, ensure_ascii=False, indent=2))
        return 1

    return 0

