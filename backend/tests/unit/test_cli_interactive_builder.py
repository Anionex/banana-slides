"""Tests for interactive JSONL builder."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from cli.banana_cli.errors import InputError
from cli.banana_cli.jobs.interactive_builder import interactive_generate


def _input_from(values: list[str]):
    it = iter(values)

    def _inner(_prompt: str) -> str:
        return next(it)

    return _inner


def test_interactive_generate_two_jobs(tmp_path: Path):
    out = tmp_path / "jobs.jsonl"

    inputs = [
        "job-001",
        "full_generation",
        "idea",
        "AI topic",
        "",
        "",
        "",
        "zh",
        "",
        "",
        "y",
        "",
        "",
        "pptx,pdf",
        "demo",
        "",
        "",
        "",
        "",
        "",
        "job-002",
        "export_only",
        "project-123",
        "pdf,images",
        "",
        "id1,id2",
        "2",
        "5",
        "n",
        "900",
    ]

    path = interactive_generate(
        output_path=str(out),
        job_count=2,
        input_fn=_input_from(inputs),
        print_fn=lambda _m: None,
    )

    assert path == out
    lines = out.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2

    job1 = json.loads(lines[0])
    job2 = json.loads(lines[1])

    assert job1["job_type"] == "full_generation"
    assert job1["creation_type"] == "idea"
    assert job1["export"]["formats"] == ["pptx", "pdf"]
    assert job1["policy"]["continue_on_error"] is True

    assert job2["job_type"] == "export_only"
    assert job2["project_id"] == "project-123"
    assert job2["export"]["formats"] == ["pdf", "images"]
    assert job2["export"]["page_ids"] == ["id1", "id2"]
    assert job2["policy"]["continue_on_error"] is False
    assert job2["policy"]["timeout_sec"] == 900


def test_interactive_generate_decline_overwrite(tmp_path: Path):
    out = tmp_path / "jobs.jsonl"
    out.write_text("{}", encoding="utf-8")

    with pytest.raises(InputError):
        interactive_generate(
            output_path=str(out),
            job_count=1,
            input_fn=_input_from(["n"]),
            print_fn=lambda _m: None,
        )

