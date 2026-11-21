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
one introduction paragraph, navigation, daily statistics, version/license/tool
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
The renderer updates hero sections, the text fallback footer and their translation snapshots.

The hero uses paired links ending in `#gh-light-mode-only` and
`#gh-dark-mode-only`. GitHub's own CSS selects the visible link from the page's
`data-color-mode`, including automatic mode. This does not depend on the
`themed-picture` JavaScript component initializing after the page theme.
The original picture markup remains an intermediate format for the renderer.

A destination with a fragment needs a matching theme-specific anchor, not just
an appended suffix. Deployment and community sections include these aliases;
unsupported external fragments retain their original picture/link markup.
Verify initial dark loads, subsequent theme changes, opposite system/page themes,
and reloads with page scripts disabled. Check actual link targets as well as pixels.

Do not rely on themed images' `alt` text as a network-error fallback: GitHub's
`themed-picture` may keep failed images hidden, and plain image alt text is not a full navigation fallback. The end of each README includes a collapsed,
image-free text version with native navigation, project links and sponsor copy.
The renderer derives sponsor text and destinations from the corresponding
localized sponsor section; the disclosure must remain usable with all images
blocked. This is a manually opened fallback, not an automatic replacement for
failed images. Preserve the original wording and link fragments.

Community buttons form a second centered row below the four main actions.
Their labels and destinations live in `docs/i18n/languages.json`; WeChat links
point to each edition's existing community QR-code section. The image-free
footer includes both destinations. Brand icon paths are unmodified Simple Icons
from `@iconify-json/simple-icons` 1.2.99 (CC0-1.0), retained in
`assets/readme/community-icons.json` with attribution and license metadata.

Sponsor logos use the original PNG assets directly, without added frames or
background plates. Sponsor links remain native text links so they are visible
and clickable even when all images fail to load. Preserve their original copy
and destinations.

Stars, forks and watchers use transparent local light/dark SVGs. The
`Refresh README metrics` workflow refreshes them daily at 03:17 UTC (11:17 in
China/Singapore; GitHub scheduling can be delayed), or via `workflow_dispatch`
on `main`. Ordinary pushes do not trigger a refresh. The workflow uses GitHub's
built-in token and commits only the six statistics SVGs when displayed values
change, with an English Conventional Commit. No extra secret is required.

Run `python3 scripts/refresh_readme_metrics.py` for a local refresh. It validates
all three counts from one GitHub repository API response before writing. Watchers
uses `subscribers_count`, not `watchers_count` (which is the star count). Transient
network errors get at most three attempts with 20-second request timeouts;
invalid data or exhausted retries fail the task and preserve the last good images.
File-write failures roll back the batch. An upstream error SVG can be a successful
image response, so neither alt text nor changing cache parameters is a reliable
fallback. Never publish upstream error text as a badge or substitute zero counts.

The ordinary hero renderer stays offline and never overwrites these snapshots.
The AGPL-3.0 license SVG is static and generated locally by the hero renderer.
HelloGitHub
supports `theme=dark` (light fallback: `theme=neutral`). Trendshift's official
badge embed does not expose a dark option as of 2026-10-15; `?theme=dark` returned
the same white SVG. The dark theme uses a local palette adaptation of the official
artwork; the light theme keeps the live official URL. The dark copy is a snapshot
of the verified best daily rank at generation time, not a live API image. To refresh its ranking
from the official source, run `python3 scripts/refresh_trendshift_badge.py` and
commit the resulting SVG. The script validates the source layout and preserves
all labels and artwork while changing only colors.
