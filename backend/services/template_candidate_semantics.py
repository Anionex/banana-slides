"""Helpers for issue #406 template-candidate semantics.

These candidates are intentionally treated as slide template/style candidates,
not as generic illustrations. Even while the endpoint still returns mock images,
the product contract is already fixed:

1. The generated image should look like a reusable slide template reference.
2. When a user selects one, downstream code should keep using the existing
   project template upload flow (`POST /api/projects/<id>/template`).
3. There is no separate "reference image" persistence path for candidates.
"""

from __future__ import annotations

TEMPLATE_CANDIDATE_SYSTEM_PROMPT = (
    "Generate slide template/style candidate images for presentation creation. "
    "Each candidate must read as a reusable PPT template reference with visible "
    "layout, typography, color, and decoration decisions. Do not generate a "
    "standalone illustration or subject-centric poster."
)


def build_template_candidate_prompt(style_prompt: str, aspect_ratio: str | None = None) -> str:
    """Build the explicit semantic prompt for template-candidate generation.

    The helper exists even before real model integration so the intended meaning
    is documented in code and testable via the API response contract.
    """

    ratio_clause = f" Target aspect ratio: {aspect_ratio}." if aspect_ratio else ""
    return (
        f"{TEMPLATE_CANDIDATE_SYSTEM_PROMPT}{ratio_clause} "
        "The selected candidate will be uploaded as the project's template image "
        "and reused during downstream page generation. "
        f"Style request: {style_prompt.strip()}"
    )


def build_template_candidate_usage_note() -> str:
    """Describe how downstream code must consume a selected candidate."""

    return (
        "Selecting a candidate must continue through the existing project "
        "template upload flow so downstream page generation uses it as the "
        "project template image. No separate candidate/reference path is added."
    )