"""Small PNG fallback renderer for PPTX native math AlternateContent."""
from __future__ import annotations

import io
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont
from pptx.oxml.ns import qn


Color = Tuple[int, int, int, int]


@dataclass
class _Box:
    width: int
    ascent: int
    descent: int
    draw: Callable[[ImageDraw.ImageDraw, int, int, Color], None]

    @property
    def height(self) -> int:
        return self.ascent + self.descent


def render_omml_fallback_png(
    math_element,
    width_px: int,
    height_px: int,
    font_size_pt: float,
    color_rgb: Tuple[int, int, int],
    font_path: Optional[str] = None,
    scale: int = 2,
) -> Optional[io.BytesIO]:
    """Render the supported OMML subset to a transparent PNG stream."""
    width = max(1, int(width_px * scale))
    height = max(1, int(height_px * scale))
    color = (*color_rgb, 255)
    font_size_px = max(8, int(font_size_pt * 96 / 72 * scale))
    min_font_size_px = max(8, int(6 * 96 / 72 * scale))

    box = None
    while font_size_px >= min_font_size_px:
        box = _build_box(math_element, font_size_px, font_path)
        if box.width <= width * 0.96 and box.height <= height * 0.9:
            break
        next_size = int(font_size_px * 0.9)
        if next_size == font_size_px:
            next_size -= 1
        font_size_px = next_size

    if box is None or box.width <= 0 or box.height <= 0:
        return None

    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    x = max(0, int((width - box.width) * 0.02))
    baseline = max(box.ascent, int((height - box.height) / 2) + box.ascent)
    box.draw(draw, x, baseline, color)

    stream = io.BytesIO()
    image.save(stream, format="PNG")
    stream.seek(0)
    return stream


def _build_box(elem, font_size_px: int, font_path: Optional[str]) -> _Box:
    tag = elem.tag
    if tag == qn("m:r"):
        return _run_box(elem, font_size_px, font_path)
    if tag == qn("m:sSub"):
        return _script_box(elem, font_size_px, font_path, sub=True, sup=False)
    if tag == qn("m:sSup"):
        return _script_box(elem, font_size_px, font_path, sub=False, sup=True)
    if tag == qn("m:sSubSup"):
        return _script_box(elem, font_size_px, font_path, sub=True, sup=True)
    if tag == qn("m:f"):
        return _fraction_box(elem, font_size_px, font_path)
    if tag == qn("m:rad"):
        return _radical_box(elem, font_size_px, font_path)

    return _sequence_box(
        [
            _build_box(child, font_size_px, font_path)
            for child in elem
            if not _is_property_tag(child.tag)
        ]
    )


def _run_box(elem, font_size_px: int, font_path: Optional[str]) -> _Box:
    text = "".join(
        child.text or ""
        for child in elem
        if child.tag == qn("m:t")
    )
    return _text_box(text, font_size_px, font_path)


def _text_box(text: str, font_size_px: int, font_path: Optional[str]) -> _Box:
    if not text:
        return _empty_box(font_size_px)

    font = _load_font(font_size_px, font_path)
    probe = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font, anchor="ls")
    width = max(1, right - left)
    ascent = max(1, -top)
    descent = max(1, bottom)

    def draw_box(target: ImageDraw.ImageDraw, x: int, baseline: int, color: Color) -> None:
        target.text((x - left, baseline), text, font=font, fill=color, anchor="ls")

    return _Box(width, ascent, descent, draw_box)


def _script_box(
    elem,
    font_size_px: int,
    font_path: Optional[str],
    *,
    sub: bool,
    sup: bool,
) -> _Box:
    base = _child_box(elem, "m:e", font_size_px, font_path)
    script_size = max(6, int(font_size_px * 0.62))
    sub_box = _child_box(elem, "m:sub", script_size, font_path) if sub else None
    sup_box = _child_box(elem, "m:sup", script_size, font_path) if sup else None

    sub_offset = int(font_size_px * 0.32)
    sup_offset = int(font_size_px * 0.45)
    script_width = max(sub_box.width if sub_box else 0, sup_box.width if sup_box else 0)
    width = base.width + script_width
    ascent = base.ascent
    descent = base.descent
    if sup_box:
        ascent = max(ascent, sup_offset + sup_box.ascent)
    if sub_box:
        descent = max(descent, sub_offset + sub_box.descent)

    def draw_box(target: ImageDraw.ImageDraw, x: int, baseline: int, color: Color) -> None:
        base.draw(target, x, baseline, color)
        script_x = x + base.width
        if sup_box:
            sup_box.draw(target, script_x, baseline - sup_offset, color)
        if sub_box:
            sub_box.draw(target, script_x, baseline + sub_offset, color)

    return _Box(width, ascent, descent, draw_box)


def _fraction_box(elem, font_size_px: int, font_path: Optional[str]) -> _Box:
    script_size = max(6, int(font_size_px * 0.82))
    numerator = _child_box(elem, "m:num", script_size, font_path)
    denominator = _child_box(elem, "m:den", script_size, font_path)
    padding = max(2, int(font_size_px * 0.12))
    gap = max(2, int(font_size_px * 0.12))
    line_width = max(1, int(font_size_px * 0.045))
    width = max(numerator.width, denominator.width) + padding * 2
    ascent = numerator.height + gap + line_width
    descent = denominator.height + gap

    def draw_box(target: ImageDraw.ImageDraw, x: int, baseline: int, color: Color) -> None:
        num_x = x + (width - numerator.width) // 2
        den_x = x + (width - denominator.width) // 2
        numerator.draw(target, num_x, baseline - gap - line_width - numerator.descent, color)
        target.line((x, baseline, x + width, baseline), fill=color, width=line_width)
        denominator.draw(target, den_x, baseline + gap + denominator.ascent, color)

    return _Box(width, ascent, descent, draw_box)


def _radical_box(elem, font_size_px: int, font_path: Optional[str]) -> _Box:
    radicand = _child_box(elem, "m:e", font_size_px, font_path)
    symbol = _text_box("√", int(font_size_px * 1.18), font_path)
    gap = max(2, int(font_size_px * 0.08))
    line_width = max(1, int(font_size_px * 0.045))
    width = symbol.width + gap + radicand.width
    ascent = max(symbol.ascent, radicand.ascent + gap + line_width)
    descent = max(symbol.descent, radicand.descent)

    def draw_box(target: ImageDraw.ImageDraw, x: int, baseline: int, color: Color) -> None:
        symbol.draw(target, x, baseline, color)
        expr_x = x + symbol.width + gap
        radicand.draw(target, expr_x, baseline, color)
        y = baseline - radicand.ascent - gap
        target.line((expr_x, y, expr_x + radicand.width, y), fill=color, width=line_width)

    return _Box(width, ascent, descent, draw_box)


def _sequence_box(boxes) -> _Box:
    boxes = [box for box in boxes if box.width > 0]
    if not boxes:
        return _empty_box(12)
    width = sum(box.width for box in boxes)
    ascent = max(box.ascent for box in boxes)
    descent = max(box.descent for box in boxes)

    def draw_box(target: ImageDraw.ImageDraw, x: int, baseline: int, color: Color) -> None:
        cursor = x
        for box in boxes:
            box.draw(target, cursor, baseline, color)
            cursor += box.width

    return _Box(width, ascent, descent, draw_box)


def _empty_box(font_size_px: int) -> _Box:
    return _Box(
        max(1, int(font_size_px * 0.15)),
        max(1, int(font_size_px * 0.7)),
        max(1, int(font_size_px * 0.25)),
        lambda *_: None,
    )


def _child_box(elem, child_qname: str, font_size_px: int, font_path: Optional[str]) -> _Box:
    child = elem.find(qn(child_qname))
    if child is None:
        return _empty_box(font_size_px)
    return _build_box(child, font_size_px, font_path)


def _is_property_tag(tag: str) -> bool:
    local = tag.rsplit("}", 1)[-1]
    return local.endswith("Pr") or tag == qn("a:rPr")


@lru_cache(maxsize=128)
def _load_font(font_size_px: int, font_path: Optional[str]) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/STIXTwoMath.otf",
        "/System/Library/Fonts/Supplemental/STIXGeneral.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    if font_path:
        candidates.append(font_path)

    for path in candidates:
        if not path or not os.path.exists(path):
            continue
        try:
            return ImageFont.truetype(path, font_size_px)
        except OSError:
            continue
    return ImageFont.load_default()
