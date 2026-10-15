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
the same white SVG. Keep its live official URL so its ranking remains current.
