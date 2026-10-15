These OFL-licensed fonts are used only to generate the README hero, not loaded by the app.

- Fredoka: https://fonts.google.com/specimen/Fredoka — `fonts/Fredoka-OFL.txt`
- Nunito: https://fonts.google.com/specimen/Nunito — `fonts/Nunito-OFL.txt`

The variable TTF files come from Google Fonts' `ofl/fredoka` and `ofl/nunito` directories.
Run `uv run scripts/generate_readme_hero.py` from the repository root to regenerate
both transparent SVGs. The script embeds the existing desktop logo and outlines
the text, so GitHub needs no external fonts or image dependencies.

The README uses `<picture>` to select a light or dark hero. HelloGitHub also
supports `theme=dark` (light fallback: `theme=neutral`). Trendshift's official
badge embed does not expose a dark option as of 2026-10-15; `?theme=dark` returned
the same white SVG. The dark theme uses a local palette adaptation of the official
artwork; the light theme keeps the live official URL. The dark copy is a snapshot
of the verified best daily rank at generation time, not a live API image. To refresh its ranking
from the official source, run `python3 scripts/refresh_trendshift_badge.py` and
commit the resulting SVG. The script validates the source layout and preserves
all labels and artwork while changing only colors.
