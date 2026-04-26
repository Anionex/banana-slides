"""Report writing and summary helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .errors import IOErrorCLI
from .models import RunReport


def finalize_report(report: RunReport) -> RunReport:
    report.finished_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    report.totals = {
        "total": len(report.jobs),
        "success": len([j for j in report.jobs if j.status == "SUCCESS"]),
        "failed": len([j for j in report.jobs if j.status == "FAILED"]),
    }
    return report


def write_report(report: RunReport, path: str) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        output.write_text(
            json.dumps(report.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:  # noqa: BLE001
        raise IOErrorCLI(f"Failed to write report to {output}", details=str(exc)) from exc
    return output


def print_run_summary(report: RunReport) -> None:
    totals = report.totals
    print(
        f"Run {report.run_id}: total={totals.get('total', 0)} "
        f"success={totals.get('success', 0)} failed={totals.get('failed', 0)}"
    )


def print_json(data: object) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))
