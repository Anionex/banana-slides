"""Helpers for template-candidate semantics.

These candidates are slide template/style references, not generic illustrations.
They are transient and should still flow through the existing template upload
pipeline after selection.
"""

from __future__ import annotations

TEMPLATE_CANDIDATE_SYSTEM_PROMPT = (
    "Generate slide template/style candidates for a presentation. "
    "Focus on overall layout, typography, color palette, spacing, and visual hierarchy. "
    "Return reusable template/reference-like slide visuals rather than decorative illustrations."
)


def build_template_candidate_prompt(style_prompt: str, count: int = 5, aspect_ratio: str | None = None) -> str:
    parts = [
        TEMPLATE_CANDIDATE_SYSTEM_PROMPT,
        f"Style description: {style_prompt.strip()}",
        f"Candidate count: {count}",
    ]
    if aspect_ratio:
        parts.append(f"Aspect ratio: {aspect_ratio}")
    return "\n".join(parts)


def build_template_candidate_usage_note() -> str:
    return (
        "These candidates are transient slide template/style references. "
        "If a user selects one, upload it through the existing project template flow. "
        "Do not create a separate candidate persistence path."
    )
