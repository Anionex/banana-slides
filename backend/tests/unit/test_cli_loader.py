"""Tests for banana-cli job loader."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from cli.banana_cli.jobs.loader import load_jobs


def test_load_jsonl_jobs(tmp_path: Path):
    img = tmp_path / "template.png"
    img.write_bytes(b"x")
    jobs_path = tmp_path / "jobs.jsonl"
    jobs_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "job_id": "job-1",
                        "job_type": "full_generation",
                        "creation_type": "idea",
                        "idea_prompt": "hello",
                        "template_image_path": str(img.resolve()),
                        "export": {"formats": ["pptx"]},
                    }
                ),
                json.dumps(
                    {
                        "job_id": "job-2",
                        "job_type": "export_only",
                        "project_id": "pid",
                        "export": {"formats": ["pdf", "images"]},
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )

    jobs = load_jobs(str(jobs_path))

    assert len(jobs) == 2
    assert jobs[0].job_id == "job-1"
    assert jobs[0].job_type == "full_generation"
    assert jobs[1].job_type == "export_only"
    assert jobs[1].export.formats == ["pdf", "images"]


def test_load_csv_jobs_with_options_json(tmp_path: Path):
    jobs_path = tmp_path / "jobs.csv"
    with jobs_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "job_id",
                "job_type",
                "creation_type",
                "idea_prompt",
                "outline_text",
                "description_text",
                "project_id",
                "template_image_path",
                "template_style",
                "export_formats",
                "options_json",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "job_id": "job-1",
                "job_type": "export_only",
                "project_id": "pid",
                "export_formats": "pptx;pdf",
                "options_json": json.dumps({"policy": {"timeout_sec": 120}}),
            }
        )

    jobs = load_jobs(str(jobs_path))

    assert len(jobs) == 1
    assert jobs[0].job_id == "job-1"
    assert jobs[0].project_id == "pid"
    assert jobs[0].export.formats == ["pptx", "pdf"]
    assert jobs[0].policy.timeout_sec == 120
