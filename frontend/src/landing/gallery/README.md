# Public presentation gallery

Website-only page on `production/bananaslides-online`. The public entry loads it separately from the editor at `/gallery/` and `/en/gallery/`. Each presentation has a detail page at `/gallery/<id>/` and `/en/gallery/<id>/`. Legacy `?deck=<id>&slide=<page>` links redirect to the matching detail page.

## Content

The curated collection contains 11 PDF presentations (75 pages) linked by Anionex in [issue #2](https://github.com/Anionex/banana-slides/issues/2), including its comments. `sources.json` records the original filename, author, PDF URL and exact issue/comment URL. `manifest.json` adds rendered page dimensions. Original PDF URLs are retained in the source records for provenance; the gallery has no original-post, PDF-download or presentation-picker controls. The site serves local WebP previews from `frontend/public/gallery` and never calls a generation API.

Titles/categories are navigation labels. PDF contents, including original credits and placeholders, remain as shared. Both DeepSeek files are distinct presentations.

To add or refresh a curated source, update `sources.json`, then run from the repository root:

```sh
python3 scripts/prepare_gallery.py
# Or refresh one existing source:
python3 scripts/prepare_gallery.py --only xian
```

The standard-library runner uses curl, Poppler (`pdfinfo`, `pdftoppm`) and cwebp. It downloads immutable PDFs into ignored `.cache/gallery`, renders every page at up to 1600 pixels, writes 800-pixel covers, and updates the manifest and asset index. Downloads have bounded retries; conversions have hard timeouts. Temporary render files are cleaned up. Commit sources, manifest and generated images together. Original artwork provenance for every image is the matching deck's `pdf` field; no generated artwork is used.

The ecology presentation (`ecology`, 人类活动对生态环境的影响) was explicitly removed at the user’s request. Keep it excluded from future imports and gallery refreshes.

## Gallery page

`Gallery.tsx` is the website-only collection at `/gallery/` and `/en/gallery/`.
It adapts the approved grid demo to the site's typography, theme and navigation.
The homepage showcase below is unchanged. Homepage and gallery share
`../LandingHeader.tsx` (the existing Waymark header) and `../Footer.tsx`
(the existing animated grain ribbon). Gallery navigation points to the matching
language's homepage sections; the current gallery link has `aria-current`.
The gallery header stays in normal document flow without scroll contraction;
only the homepage keeps the sticky, shrinking behavior.
Community provenance stays below the collection, separate from the site footer.

- Three columns on wide screens, two on tablets, one on phones. Every preview is
  16:9 with `object-fit: contain`, preserving the complete original artwork.
- `catalog.ts` adds bilingual, editorial style labels and a curated order to the
  existing manifest. Style chips, use-case selection and bilingual text search
  combine; results and facet counts reflect the current query.
- Filter motion follows [Özer's Filter Grid on 21st](https://21st.dev/@ddoemonn/components/filter-grid),
  verified against the author's [public source](https://www.interior.dev/docs/filter-grid).
  `filterMotion.ts` retains its chip/card spring settings, 0.97 entrance scale,
  0.98 exit scale and 140ms exit. Motion's `popLayout` and stable deck IDs preserve
  continuity during style, use-case and search changes. Existing responsive grid
  sizes, document scrolling and slide state stay intact; exiting cards are inert.
  For large slide previews, layout and entrance wait for the 140ms exit, and the
  full card has an opaque surface so captions cannot show through another card.
  The active chip disables shared-layout crossfade and keeps labels above it.
  Reduced motion removes spatial transitions and first render remains immediate.
- The use-case picker and language switcher share `../ChoiceMenu.tsx`, extracted
  from the existing language menu. Both use the same Base UI radio menu, popup,
  spacing, checked indicator, light/dark styles and keyboard/focus behavior.
- The toolbar uses the same grid tracks in both languages. Search stays beside
  the style chips at 1200px and above, and moves below them at a shared breakpoint.
  Narrow-screen style chips scroll horizontally instead of wrapping by text width.
- `DeckCard.tsx` owns no persistent page state: the parent retains each deck's page
  and overview selection. The first six works use pre-rendered 1600×900
  WebP overview images in `public/gallery/overviews`, with separate `zh`/`en` assets.
  Each overview loads one image; original slides mount only when browsing begins.
  Returning from a detail page restores the overview for these decks.
  Editable compositions remain in `DeckOverviewArtwork.tsx` and `deck-overview.css`:
  on the development server, append `?cover-artwork` to `/gallery/` or `/en/gallery/`.
  To regenerate, capture each fully loaded `.deck-overview` at ≥1600×900, without
  the parent card's corner clipping or browser gutters, as `<deck>-<language>.png`.
  Run `node scripts/encode-gallery-covers.mjs <capture-directory>` (requires `cwebp`)
  to validate all twelve captures and encode the production assets. Pass deck IDs after
  the capture directory to encode only selected works. A dedicated development-only
  capture surface is `/scripts/cover-artwork.html?deck=<id>&lang=zh` (or `en`),
  rendered at 1600×900; wait for images and fonts before capturing.
- The parent retains each deck's page
  across filtering, language/theme changes and viewport changes. Arrows, keyboard
  navigation and horizontal pointer swipes turn slides; vertical scrolling stays
  native. Dragging suppresses the subsequent open action.
- `DeckDetail.tsx` displays the original slides, metadata, a copyable style reference
  and three related works. It reuses the shared header/footer, cards, image
  transitions and thumbnail strip. Clicking a gallery card opens this page;
  clicking its main preview opens the viewer.
- `DeckViewer.tsx` uses the site's existing Base UI Dialog for focus trapping,
  Escape and focus return. It opens the current slide, synchronizes changes back
  to the detail preview, provides a scrollable thumbnail strip and optional fullscreen.
  First/last slide controls are disabled rather than wrapping into another deck.
- URL parameters `q`, `style` and `category` preserve filters when returning to the
  gallery. One-based `slide` restores the detail preview on reload. Language
  switching preserves the work and page. Invalid values are normalized.
- `SlideImage.tsx` reserves the image area, lazy loads below the fold and exposes
  a retry action on image failure. No generation or backend API is required.
- `collection.css` is isolated from the homepage. The former curve/renderer files
  and `gallery.css` remain in this worktree for prior work, but the collection
  entry no longer imports them.

Style descriptions are navigation labels based on the original artwork, not
product presets. `deepseek` is the five-page paper/linework deck;
`deepseek-tech` is the sixteen-page blue technology deck.

## Detail metadata and design

`sources.json` holds each work's `creation` record: creator-confirmed model,
generation method, bilingual full style prompt and provenance. `manifest.json`
preserves these records during asset generation. `deckDetails.ts` exposes them to
the detail page. All works use Nanobanana Pro. Five use app text presets; six use
reference images, with an explicit AI-inference disclaimer. Preset prompts are
snapshots from `presetStylesI18n.ts`; inferred prompts retain the source image,
analysis model and extraction-prompt function. Aspect ratios still derive from
rendered source dimensions.

Reference extraction reuses `backend/services/prompts.py:get_style_extraction_prompt`
via the installed `glance` CLI. With scoped `VISION_*` credentials configured, run
`python3 scripts/extract-gallery-styles.py --output <cache-directory>`; unchanged
image/prompt/model inputs reuse cached successful results. The script only produces
reviewable extraction files, never silently modifies published metadata.

Prompt text scrolls internally after 240px. The copy action always copies the full
prompt, while the source or inference note remains visible outside the scroll area.

[DESIGN.md](./DESIGN.md) records the detail page's hierarchy, responsive layout,
reused components, interaction decisions and Gemini layout review. The online
build prerenders all 22 bilingual detail routes alongside the home/gallery pages.

## Verification

```sh
cd frontend
npm run test:run -- src/landing/gallery/catalog.test.ts src/utils/publicLanding.test.ts
npx eslint src/landing/gallery/{Gallery,DeckCard,DeckViewer,SlideImage}.tsx src/landing/gallery/{catalog,useSlideSwipe,catalog.test}.ts
npm run build:online
```

The existing local service on 43187 serves `/tmp/banana-gallery/preview`, not
`frontend/dist`. After a successful build, update that generated directory with
`rsync -a --delete dist/ /tmp/banana-gallery/preview/` from `frontend`.
This only updates the local preview; it does not deploy the public website.
The former gallery audit scripts target the curved interaction and are not
acceptance tests for this grid.

The grid verification passed: 11 decks / 75 local images, 9 catalog/routing
unit tests, scoped ESLint, online build and bilingual prerender, desktop/tablet/
phone layout without horizontal overflow, search empty-state recovery, style and
use-case filtering, independent page retention, mouse drag without accidental
opening, dialog/card synchronization, thumbnail selection, Escape/focus return,
last-page deep links, light/dark themes and no browser console errors.
The mechanical design scan returned no findings. Repository-wide TypeScript
checking still reports errors outside the gallery files. Browser fullscreen and
real touch-event injection are unavailable in the in-app test browser; responsive
phone layout and the shared pointer-swipe path were checked instead.

## Homepage integration

`Landing.tsx` renders `GalleryCurvedShowcase.tsx` directly between ProductShowcase
and AudienceShowcase. `#works-curved` is the stable homepage entry and the return
target for detail pages opened from this section.

The approved showcase uses the six curated bilingual overview images, a flat
center card, curved side cards and faded edges within the site's content gutters.
It retains the heading, current-work link, arrows, pagination dots and gallery CTA.
Autoplay advances idle works when the section is visible; hovering, reading or
keyboard focus pauses it. Clicking the center work opens its in-place slide belt.
The existing `CurvedGallery`, `WheelDeck`, renderer and motion helpers provide the
interaction. Document scrolling remains native until reading a selected deck.

The discarded worktable, screening room, story tracks, comparison, atlas and
animated-scroll prototypes, their styles and the comparison navigation have been
removed. The separate collection and presentation detail pages remain available.
