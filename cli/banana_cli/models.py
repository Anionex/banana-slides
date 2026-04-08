"""Data models for batch jobs and reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class ExportOptions(BaseModel):
    formats: list[Literal["pptx", "pdf", "images", "editable_pptx"]] = Field(
        default_factory=lambda: ["pptx"]
    )
    filename_prefix: str | None = None
    page_ids: list[str] = Field(default_factory=list)
    editable_max_depth: int = 1
    editable_max_workers: int = 4


class JobPolicy(BaseModel):
    continue_on_error: bool = True
    timeout_sec: int = 1800


class JobSpec(BaseModel):
    job_id: str | None = None
    job_type: Literal["full_generation", "export_only"]

    creation_type: Literal["idea", "outline", "descriptions"] | None = None
    idea_prompt: str | None = None
    outline_text: str | None = None
    description_text: str | None = None

    project_id: str | None = None
    template_image_path: str | None = None
    template_style: str | None = None
    extra_requirements: str | None = None

    language: Literal["zh", "en", "ja", "auto"] | None = None
    max_description_workers: int | None = None
    max_image_workers: int | None = None
    use_template: bool = True

    reference_files: list[str] = Field(default_factory=list)
    material_files: list[str] = Field(default_factory=list)

    export: ExportOptions = Field(default_factory=ExportOptions)
    policy: JobPolicy = Field(default_factory=JobPolicy)

    @model_validator(mode="after")
    def validate_job(self) -> "JobSpec":
        if self.job_type == "export_only":
            if not self.project_id:
                raise ValueError("project_id is required for export_only job")
            return self

        if self.creation_type is None:
            raise ValueError("creation_type is required for full_generation job")
        if self.creation_type == "idea" and not self.idea_prompt:
            raise ValueError("idea_prompt is required when creation_type=idea")
        if self.creation_type == "outline" and not self.outline_text:
            raise ValueError("outline_text is required when creation_type=outline")
        if self.creation_type == "descriptions" and not self.description_text:
            raise ValueError("description_text is required when creation_type=descriptions")
        return self


class TaskRecord(BaseModel):
    task_id: str
    type: str
    status: str


class ArtifactRecord(BaseModel):
    format: str
    download_url: str


class JobError(BaseModel):
    code: str | None = None
    message: str | None = None


class JobReport(BaseModel):
    job_id: str
    status: Literal["SUCCESS", "FAILED"]
    project_id: str | None = None
    tasks: list[TaskRecord] = Field(default_factory=list)
    artifacts: list[ArtifactRecord] = Field(default_factory=list)
    error: JobError = Field(default_factory=JobError)
    duration_sec: int = 0


class RunReport(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid4()))
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    finished_at: str | None = None
    base_url: str
    totals: dict[str, int] = Field(default_factory=lambda: {"total": 0, "success": 0, "failed": 0})
    jobs: list[JobReport] = Field(default_factory=list)


def normalize_job_id(job: JobSpec, index: int) -> str:
    return job.job_id or f"job-{index:04d}"


def parse_formats(value: str | None) -> list[str]:
    if not value:
        return []
    chunks = [p.strip() for part in value.split(";") for p in part.split(",")]
    return [c for c in chunks if c]


def merge_dict(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged
