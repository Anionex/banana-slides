# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.60.1", "pillow==11.3.0", "uharfbuzz==0.51.0"]
# ///
"""Regenerate both transparent README banners: uv run scripts/generate_readme_hero.py.

Fonts are bundled under assets/fonts with their OFL licenses. Text is shaped and
converted to paths; the existing app logo is embedded, so SVGs need no external
fonts or images. No image generation or network calls are involved.
"""

import base64
import io
import json
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1720, 360


def lettering(text, font_name, weight, size, x, baseline):
    font = instantiateVariableFont(
        TTFont(ROOT / "assets/fonts" / font_name), {"wght": weight}, inplace=True
    )
    buffer = io.BytesIO()
    font.save(buffer)
    face = hb.Face(buffer.getvalue())
    shaping_font = hb.Font(face)
    shaping_font.scale = (face.upem, face.upem)
    shaped = hb.Buffer()
    shaped.add_str(text)
    shaped.guess_segment_properties()
    hb.shape(shaping_font, shaped)
    glyphs = font.getGlyphSet()
    names = font.getGlyphOrder()
    scale = size / face.upem
    pen = SVGPathPen(glyphs, ntos=lambda n: f"{n:.2f}".rstrip("0").rstrip("."))
    cursor = 0
    for info, pos in zip(shaped.glyph_infos, shaped.glyph_positions):
        glyphs[names[info.codepoint]].draw(TransformPen(pen, (
            scale, 0, 0, -scale,
            x + (cursor + pos.x_offset) * scale,
            baseline - pos.y_offset * scale,
        )))
        cursor += pos.x_advance
    assert x + cursor * scale < WIDTH - 24, f"Text overflows: {text}"
    return pen.getCommands()


def main():
    logo = Image.open(ROOT / "desktop/resources/BananaSlides.icon/Assets/brand-logo.png").convert("RGBA")
    alpha = logo.getchannel("A")
    assert alpha.getextrema() == (0, 255), "Logo must have real transparency"
    logo = logo.crop(alpha.getbbox())
    logo.thumbnail((640, 640), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    logo.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode()
    logo_height = 320 * logo.height / logo.width
    title = lettering("Banana Slides", "Fredoka.ttf", 650, 195, 415, 204)
    tagline = lettering("Vibe your way to great slides.", "Nunito.ttf", 750, 66, 419, 284)
    results = []
    for theme, foreground, muted in [
        ("light", "#24292f", "#59636e"),
        ("dark", "#f0f6fc", "#b7c1cc"),
    ]:
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Banana Slides</title>
  <desc id="desc">Vibe your way to great slides.</desc>
  <image x="55" y="{(HEIGHT-logo_height)/2:.2f}" width="320" height="{logo_height:.2f}" xlink:href="data:image/png;base64,{encoded}"/>
  <path fill="{foreground}" d="{title}"/>
  <path fill="{muted}" d="{tagline}"/>
</svg>
'''
        path = ROOT / f"assets/hero-{theme}.svg"
        path.write_text(svg)
        results.append({"file": str(path.relative_to(ROOT)), "bytes": path.stat().st_size})
    print(json.dumps({"status": "ok", "size": [WIDTH, HEIGHT], "transparent": True, "files": results}))


if __name__ == "__main__":
    main()
