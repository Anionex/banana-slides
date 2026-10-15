The README hero is a transparent PNG, 1920 × 480 pixels, with light and dark
lettering variants. Its lettering comes from the approved image-generation draft;
the logo is composited directly from
`desktop/resources/BananaSlides.icon/Assets/brand-logo.png` without redrawing.
The two variants have identical alpha channels and logo pixels.

The AIHubMix sponsor logo retains its original icon and letter shapes. Its white
rectangle is removed, with a thin white outline around the black lettering for
contrast on dark backgrounds.

The cover is assembled as centered Markdown/HTML rows. It reuses these original
brand PNGs and the original recommendation artwork. Order: brand, language links,
one introduction paragraph, navigation, live statistics, version/license/tool
badges, recommendations, and Star / Fork with thin rules on both sides.
Each navigation button, metric, recommendation, and support action remains a
separate link. Mobile rows wrap naturally; there is no fixed-width HTML table.

`assets/buttons/` contains language pills and light/dark navigation SVGs.
The connected language control is 24 pixels tall. Its curved joins are visual;
each independently linked SVG has a rectangular click area.
`assets/readme/` contains transparent typography, icons, and small spacing pieces.
Icons use vendored Lucide geometry with its ISC license retained alongside them.
No scripts, external fonts, foreignObject, or SVG-internal links are required.
Run `node scripts/generate_readme_buttons.mjs` then
`python3 scripts/render_readme_hero.py`; both support `--check`.
The renderer changes only hero sections and their matching translation snapshots.

GitHub wraps native `<picture>` markup in its `themed-picture` component and
selects sources using the GitHub page theme. This keeps section anchor URLs intact.
When verifying injected Markdown on GitHub, set the page theme BEFORE inserting
the fragment; changing the root attribute afterwards does not trigger the native
component's theme event. Verify system/page themes both matching and opposite,
as well as automatic mode, and inspect actual image `currentSrc`.

Stars, forks, watchers and license remain live Shields images with neutral
backgrounds matching GitHub's light/default dark palettes; figures are not frozen
in local SVGs. Other custom GitHub dark palettes may show a slight background tint.
HelloGitHub also
supports `theme=dark` (light fallback: `theme=neutral`). Trendshift's official
badge embed does not expose a dark option as of 2026-10-15; `?theme=dark` returned
the same white SVG. The dark theme uses a local palette adaptation of the official
artwork; the light theme keeps the live official URL. The dark copy is a snapshot
of the verified best daily rank at generation time, not a live API image. To refresh its ranking
from the official source, run `python3 scripts/refresh_trendshift_badge.py` and
commit the resulting SVG. The script validates the source layout and preserves
all labels and artwork while changing only colors.
