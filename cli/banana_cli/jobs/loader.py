"""Load batch jobs from JSONL or CSV."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ..errors import InputError
from ..models import JobSpec, merge_dict, parse_formats


def _validate_upload_path(path_str: str) -> None:
    p = Path(path_str)
    if not p.is_absolute():
        raise InputError(f"Upload path must be absolute: {path_str}")
    if not p.exists():
        raise InputError(f"Upload path does not exist: {path_str}")


def _validate_job(job: JobSpec) -> JobSpec:
    if job.template_image_path:
        _validate_upload_path(job.template_image_path)
    for fp in job.reference_files:
        _validate_upload_path(fp)
    for fp in job.material_files:
        _validate_upload_path(fp)
    return job


def load_jobs(file_path: str) -> list[JobSpec]:
    path = Path(file_path)
    if not path.exists():
        raise InputError(f"Job file not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix == ".jsonl":
        return load_jsonl_jobs(path)
    if suffix == ".csv":
        return load_csv_jobs(path)
    raise InputError("Job file must end with .jsonl or .csv")


def load_jsonl_jobs(path: Path) -> list[JobSpec]:
    jobs: list[JobSpec] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            payload = json.loads(stripped)
            job = JobSpec.model_validate(payload)
            jobs.append(_validate_job(job))
        except json.JSONDecodeError as exc:
            raise InputError(f"Invalid JSONL at line {lineno}", details=str(exc)) from exc
        except ValidationError as exc:
            raise InputError(f"Invalid job schema at line {lineno}", details=exc.errors()) from exc
    if not jobs:
        raise InputError("No jobs found in JSONL file")
    return jobs


def load_csv_jobs(path: Path) -> list[JobSpec]:
    jobs: list[JobSpec] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            try:
                base: dict[str, Any] = {
                    "job_id": _none_if_empty(row.get("job_id")),
                    "job_type": _none_if_empty(row.get("job_type")),
                    "creation_type": _none_if_empty(row.get("creation_type")),
                    "idea_prompt": _none_if_empty(row.get("idea_prompt")),
                    "outline_text": _none_if_empty(row.get("outline_text")),
                    "description_text": _none_if_empty(row.get("description_text")),
                    "project_id": _none_if_empty(row.get("project_id")),
                    "template_image_path": _none_if_empty(row.get("template_image_path")),
                    "template_style": _none_if_empty(row.get("template_style")),
                }

                export_formats = parse_formats(row.get("export_formats"))
                if export_formats:
                    base["export"] = {"formats": export_formats}

                extra_raw = _none_if_empty(row.get("options_json"))
                if extra_raw:
                    extra = json.loads(extra_raw)
                    if not isinstance(extra, dict):
                        raise InputError(f"options_json must be an object at CSV line {row_idx}")
                    base = merge_dict(base, extra)

                cleaned = {k: v for k, v in base.items() if v is not None and v != ""}
                job = JobSpec.model_validate(cleaned)
                jobs.append(_validate_job(job))
            except json.JSONDecodeError as exc:
                raise InputError(f"Invalid options_json at CSV line {row_idx}", details=str(exc)) from exc
            except ValidationError as exc:
                raise InputError(f"Invalid job schema at CSV line {row_idx}", details=exc.errors()) from exc

    if not jobs:
        raise InputError("No jobs found in CSV file")
    return jobs


def _none_if_empty(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v if v else None
