# Public presentation gallery

Website-only page on `production/bananaslides-online`. The public entry loads it separately from the editor at `/gallery/` and `/en/gallery/`. `?deck=<id>` preserves the selected presentation.

## Content

The initial collection contains all 12 PDF presentations (98 pages) linked by Anionex in [issue #2](https://github.com/Anionex/banana-slides/issues/2), including its comments. `sources.json` records the original filename, author, PDF URL and exact issue/comment URL. `manifest.json` adds rendered page dimensions. Original PDF URLs are retained in the source records for provenance; the gallery has no original-post, PDF-download or presentation-picker controls. The site serves local WebP previews from `frontend/public/gallery` and never calls a generation API.

Titles/categories are navigation labels. PDF contents, including original credits and placeholders, remain as shared. Both DeepSeek files are distinct presentations.

To add or refresh a curated source, update `sources.json`, then run from the repository root:

```sh
python3 scripts/prepare_gallery.py
# Or refresh one existing source:
python3 scripts/prepare_gallery.py --only xian
```

The standard-library runner uses curl, Poppler (`pdfinfo`, `pdftoppm`) and cwebp. It downloads immutable PDFs into ignored `.cache/gallery`, renders every page at up to 1600 pixels, writes 800-pixel covers, and updates the manifest and asset index. Downloads have bounded retries; conversions have hard timeouts. Temporary render files are cleaned up. Commit sources, manifest and generated images together. Original artwork provenance for every image is the matching deck's `pdf` field; no generated artwork is used.

## Interaction and reference

The user requested one continuous concave gallery: horizontal gestures choose a presentation; vertical gestures translate its pages in place. Reference research used 21st.dev's [Cylinder Carousel](https://21st.dev/@starc007/components/cylinder-carousel) and [Circular Gallery 2](https://21st.dev/@ravikatiyar162/components/circular-gallery-2). Their previews were inspected and Cylinder Carousel's source was consulted; no third-party component source was copied.

Native scrolling carries the horizontal track, with an eased settle after dragging and end clones for wrapping. Covers and reading pages share one canvas. The centered cover is completely flat, just like the vertical ring. Curvature develops smoothly only as works move into the side positions. Vertical pages only translate their artwork. DOM buttons and original images provide accessibility and a no-canvas fallback. The webpage headline and subtitle remain visible; the presentation title and description are visually hidden. The main page stays close to the webpage subtitle: a small fading glimpse above avoids pushing the artwork down, while a fading half-page remains below. The same anchor is used before and during reading.

Vertical progress is unbounded and maps to source pages with modulo arithmetic, so either direction loops continuously: moving backward from the first page reaches the last. The full artwork area owns wheel input, including side covers and faded page edges; vertical wheel input there starts or advances the active deck without scrolling the document. Outside the artwork, normal document scrolling remains available. Wheel input moves continuously through a damped response and hands its current velocity directly to inertia after the last event; there is no stationary timeout between input and coasting. Pointer dragging follows the pointer directly. After a vertical gesture ends, inertia first coasts with exponential decay and no page target. Only when speed falls to 0.012 pages per second or below, while still decelerating does a spring settle onto the nearest page. Reduced motion skips the coast; page buttons and keyboard navigation select pages directly.

Horizontal dragging moves the page belt and the actual cover track together, one-to-one with the pointer, then settles after release with an acceleration/deceleration curve. Adjacent vertical pages hide as soon as horizontal intent is detected. The departing pages accelerate and then decelerate back to a cover position during that horizontal movement and fade according to the distance traveled. Horizontal wheel gestures use the same track movement and snap when the gesture ends. There is no preview dialog, enter/exit button, or separate long page list. Arrow keys, page buttons and touch swipes provide alternative controls. Flat pages use one whole-image canvas draw, with offscreen pages skipped; only curved side covers use sliced rendering. Paint requests coalesce within a frame. Only five neighboring virtual page slots mount; source pages fit without cropping before canvas rendering and offer image retry.

The page inherits the website's rounded type, white/dark surfaces, yellow accent, language menu and theme toggle. Motion respects reduced-motion preferences. It introduces no editor, backend, analytics service, or production configuration change.

## Verification

```sh
cd frontend
npm ci
npm run build:online
npm run test:run -- src/utils/publicLanding.test.ts
npm run preview -- --host 127.0.0.1 --port 43187 --strictPort
```

Open the built `/gallery/` URL in a task-owned playwright-cli session, then run `frontend/scripts/gallery-audit.js` via `run-code --filename` from the repository root (create `.impeccable/review` first). The audit derives its origin from the open page, returns a structured result and captures screenshots. Verify the visible webpage headline and hidden presentation copy, a flat centered cover with smoothly curved side covers and flat vertical pages, a compact upper preview and fading half-page below, translation-only vertical motion, backward and forward page wrapping, free inertia before low-speed spring snapping, continuous pointer-following at two horizontal drag distances and snapping after release, return to the cover, presentation arrow navigation/wrapping, refresh, all preview images, real mobile touch gestures, light/dark, English, reduced motion, no-canvas fallback and image retry.

Run `frontend/scripts/gallery-motion-audit.js` in the same session to check continuous wheel-to-coast motion, low-speed snapping, drawing-call budget, repeated/reversed input, pointer interruption of inertia, and wheel ownership across side covers and faded edges. Close only that session after both audits.
