# Public presentation gallery

Website-only page on `production/bananaslides-online`. The public entry loads it separately from the editor at `/gallery/` and `/en/gallery/`. `?deck=<id>` preserves the selected presentation.

## Content

The initial collection contains all 12 PDF presentations (98 pages) linked by Anionex in [issue #2](https://github.com/Anionex/banana-slides/issues/2), including its comments. `sources.json` records the original filename, author, PDF URL and exact issue/comment URL. `manifest.json` adds rendered page dimensions. The original PDFs remain linked; the site serves local WebP previews from `frontend/public/gallery` and never calls a generation API.

Titles/categories are navigation labels. PDF contents, including original credits and placeholders, remain as shared. Both DeepSeek files are distinct presentations.

To add or refresh a curated source, update `sources.json`, then run from the repository root:

```sh
python3 scripts/prepare_gallery.py
# Or refresh one existing source:
python3 scripts/prepare_gallery.py --only xian
```

The standard-library runner uses curl, Poppler (`pdfinfo`, `pdftoppm`) and cwebp. It downloads immutable PDFs into ignored `.cache/gallery`, renders every page at up to 1600 pixels, writes 800-pixel covers, and updates the manifest and asset index. Downloads have bounded retries; conversions have hard timeouts. Temporary render files are cleaned up. Commit sources, manifest and generated images together. Original artwork provenance for every image is the matching deck's `pdf` field; no generated artwork is used.

## Interaction and reference

The user requested a concave horizontal gallery with a readable vertical deck after selection. Reference research used 21st.dev's [Cylinder Carousel](https://21st.dev/@starc007/components/cylinder-carousel) and [Circular Gallery 2](https://21st.dev/@ravikatiyar162/components/circular-gallery-2). Their previews were inspected and Cylinder Carousel's source was consulted; no third-party component source was copied.

Native horizontal scrolling and CSS scroll snap control selection. Canvas bends the cover images continuously across the viewport; DOM buttons and original images provide accessibility and a no-canvas fallback. End clones support wrapping. Vertical gestures remain native document scrolling. The full deck preserves each source page's aspect ratio, loads images lazily, and provides explicit image retry and original PDF links.

The page inherits the website's rounded type, white/dark surfaces, yellow accent, language menu and theme toggle. Motion respects reduced-motion preferences. It introduces no editor, backend, analytics service, or production configuration change.

## Verification

```sh
cd frontend
npm ci
npm run build:online
npm run test:run -- src/utils/publicLanding.test.ts
npm run preview -- --host 127.0.0.1 --port 43187 --strictPort
```

Open the built `/gallery/` URL in a task-owned playwright-cli session, then run `frontend/scripts/gallery-audit.js` via `run-code --filename` from the repository root (create `.impeccable/review` first). The audit derives its origin from the open page and verifies navigation, wrapping, mouse drag, both wheel axes, keyboard controls, refresh, all preview images, source proportions, mobile touch gestures, light/dark, English, reduced motion, no-canvas fallback, image retry and homepage entry links. It returns a structured result and captures screenshots. Close only that session afterwards.
