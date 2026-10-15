The README hero is a transparent PNG, 1920 × 480 pixels, with light and dark
lettering variants. Its lettering comes from the approved image-generation draft;
the logo is composited directly from
`desktop/resources/BananaSlides.icon/Assets/brand-logo.png` without redrawing.
The two variants have identical alpha channels and logo pixels.

The AIHubMix sponsor logo retains its original icon and letter shapes. Its white
rectangle is removed, with a thin white outline around the black lettering for
contrast on dark backgrounds.

The README uses `<picture>` to select a light or dark hero. HelloGitHub also
supports `theme=dark` (light fallback: `theme=neutral`). Trendshift's official
badge embed does not expose a dark option as of 2026-10-15; `?theme=dark` returned
the same white SVG. The dark theme uses a local palette adaptation of the official
artwork; the light theme keeps the live official URL. The dark copy is a snapshot
of the verified best daily rank at generation time, not a live API image. To refresh its ranking
from the official source, run `python3 scripts/refresh_trendshift_badge.py` and
commit the resulting SVG. The script validates the source layout and preserves
all labels and artwork while changing only colors.
