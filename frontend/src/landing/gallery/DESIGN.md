# Gallery and presentation detail decisions

## Purpose and visual hierarchy

Mode: **Experience**. The artwork leads; navigation, metadata and controls support exploration.
The gallery is a browsable collection. A presentation detail page explains one work.
The black viewer is the final, focused inspection layer: gallery → detail → viewer.

Follow the user's supplied two-column wireframe. On desktop, give the slide preview
roughly 60% of the available width and metadata the rest, separated by 44px. The
title belongs to the metadata column on desktop; do not add an eyebrow above it. Put related
works below both columns. Below 1024px the title comes before the preview; metadata and the
style description form two columns until 640px, then a single reading order.

## Reuse and component responsibilities

- Reuse `LandingHeader`, `Footer`, `LandingTheme` and `ChoiceMenu`. Do not rebuild
  approved blocks for a new route. The header remains non-sticky on gallery pages.
- Reuse the gallery's container, 16:9 media frame, typography and spacing tokens.
  Gallery content retains its approved 12px desktop optical inset.
- `SlidePreview` owns decode-before-replace slide transitions for both cards and
  detail previews. `DeckThumbnails` owns the shared filmstrip used in detail and
  fullscreen. `DeckViewer` retains the existing Base UI dialog and focus management.
- Related works reuse `DeckCard`, including local page browsing, overview covers
  and slide readiness. Similarity ranks matching style first, then use case; ties
  retain curated order. There are three recommendations, excluding the current work.

## Weight, shape, type and color

- The main slide is the largest and most colorful element. Do not decorate its tray.
- The page title uses the existing rounded brand typography, 26–34px on desktop.
  Metadata labels are 12px secondary text; values are 14px in a two-column `dl`.
  Keep this text group at most 360px wide, with 12px row gaps, 20px column gaps,
  3px between each label/value and 20px before the style reference panel. This
  modest tightening preserves the type sizes and avoids adding chips or actions.
  Browser verification measured a 96px-high metadata group (previously 104px),
  with no overflow in English at 390px. Gemini's follow-up called the result clean
  but suggested “tightening” to larger gaps than the measured 3px/20px values;
  those unsupported spacing estimates were not applied. The user's requested
  modest tightening remains the controlling direction.
  Avoid enclosing each property in a separate card or adding decorative icons.
- Charcoal is reserved for the shared Demo CTA. The enlarge action is a small
  secondary icon beside the page counter, outside the artwork.
  Yellow marks selected thumbnails, focus and modest interaction feedback.
- The style description has one 12px rounded, soft-background panel. Its copy
  action is a small text-and-icon button, not a competing primary CTA.
- Icons come from the site's existing Lucide family. No native select popup,
  default button decoration, system tooltip or unnecessary eyebrow is introduced.
- Light and dark appearances inherit existing tokens. Interactive focus, hover,
  disabled states, selection color and filmstrip scrollbars are deliberately styled.

## Interactions and navigation

- Cards use real links to `/gallery/<id>/` and `/en/gallery/<id>/`. New-tab and
  keyboard navigation work. Card arrows still browse in place; a swipe suppresses
  accidental navigation.
- The detail page starts on the selected original slide, not the composite cover.
  Thumbnails, arrows, left/right keys on the main preview and horizontal swipes
  change the current slide. First/last navigation stops at the deck boundaries.
- Clicking the main image or the enlarge icon opens the existing black viewer on
  that slide. Closing it returns focus to the control used and keeps the current page.
- Only one arrow group remains in the detail preview: small chevrons scroll the
  thumbnail strip without changing the selected slide. The native scrollbar is
  hidden; edge fades indicate additional content and disappear at boundaries.
  Native horizontal scrolling remains available. Keep these arrows on mobile
  as requested; their visual size is 16px inside 32×44px hit areas.
- `slide` is one-based in the URL. Invalid values are clamped. Old `?deck=...`
  gallery links redirect to the dedicated page. Language changes preserve the
  current work, page and gallery filters. Back-to-gallery restores valid filters.
- A copied checkmark replaces the copy icon briefly, with a live status message.
  Embedded browsers use the existing textarea-copy pattern before the Clipboard API;
  failure selects the text and gives a manual-copy message rather than fake success.
- Spatial motion is restrained: a 220ms image crossfade after decoding and smooth
  thumbnail scrolling. Reduced-motion preferences remove animation.
- The gallery toolbar uses explicit shared breakpoints, never locale-dependent
  flex wrapping. Chinese and English keep the same search placement at equal widths.

## Metadata truth

`manifest.json` is the source of titles, contributor, original page dimensions and
page count. Ratios near widescreen are labeled `≈ 16:9` when dimensions are not exact.
All 11 works use **Nanobanana Pro**, confirmed by the creator on 2026-10-18.
Creation metadata lives in `sources.json` and is copied unchanged to `manifest.json`
by the existing asset pipeline. The detail page reads these records rather than
maintaining a separate editorial prompt collection.

Five works match the app's text presets and their preview pages: `deepseek` →
`academic-formal`, `saas` → `business-simple`, `quantum` → `tech-modern`, `moutai` →
`luxury-premium`, `gen-z` → `gradient-vibrant`. Their Chinese and English prompt
snapshots are copied verbatim from `presetStylesI18n.ts`; source key, preset name,
preview image and snapshot date are retained. These are the current app preset
texts, not recovered historical generation logs. The owner requested these app
texts; the business preset may have evolved since the published work.

The other six works match image templates: `software` → vector illustration,
`money` and `xian` → parchment, `food-production` → academic image,
`deepseek-tech` → blue tech, `cnn` → blue-white business. The academic **image**
template is distinct from the `academic-formal` **text** preset. This is supported
by the source post's template image and the app's actual template assets.

`extract-gallery-styles.py` imports the application's exact
`get_style_extraction_prompt()` and runs it through the existing `glance` vision
client with configured `gemini-3.8-flash`. This local gallery service has no app
backend, so extraction reuses the prompt and image-analysis path rather than
claiming an `/api/extract-style` endpoint call. Five unique image templates were
analyzed; the parchment result is shared by two works. Chinese responses are
preserved verbatim, with English translations. Source image, analysis model,
prompt function and content fingerprint are saved separately from the **generation**
model. The visible note explicitly labels these as inferred, not original prompts.

The metadata remains a compact two-column definition list, now three rows. Long
prompts have a **240px maximum height** in both languages and all breakpoints;
shorter prompts size to content. Only the text area scrolls, with a thin muted
scrollbar, contained overscroll and keyboard focus support. Copy and provenance
stay outside the scrolling area. Markdown emphasis renders normally; copying uses
the full unmodified prompt, including formatting, irrespective of scroll position.

## Review and delivery

User review method: ask Gemini naturally and openly about the whole page first,
without steering its verdict or restricting what it may critique. Confirm any
small-component finding using a close-up before changing it.
2026-10-18: `glance` called configured `gemini-3.8-flash` with complete Chinese
desktop and mobile captures. Asked only whether overall layout was reasonable.
Gemini found the hierarchy clear, the artwork dominant and the mobile order
coherent; recommended **no layout change**. No local-component changes were made
from that review. The clipboard compatibility correction came from browser testing.
Screenshots and exact review are in the task's `outputs/banana-gallery-final/details`.

The subsequent unrestricted question, “这个作品详情页的布局合理吗？”, produced
material feedback that the constrained first review missed: competing arrow
groups, the enlarge label covering slide content, mobile title placement and
thumbnail space, missing-model noise, and a possible creation CTA. The earlier
“no change” verdict is therefore not sufficient design acceptance. These are
review findings, not approved changes; verify details and product capability
before implementation. Future reviews must use open, natural questions.

Follow-up refinement: a close-up confirmed that the enlarge label covered source
content and the two arrow groups were ambiguous. Moved enlarge outside the image,
removed the separate main-slide arrow group, retained keyboard/swipe/thumbnail
navigation, moved the title before the preview below 1024px and hid absent models.
The same open question on updated desktop/mobile screenshots found the responsive
order appropriate. Remaining suggestions were a creation/download/favorite flow,
denser metadata, larger arrow hit areas and fewer page numbers. These are recorded,
not applied automatically: product actions need supported flows, numbering supports
precise navigation, and the user explicitly requested visually quiet arrows.
Build and scoped lint passed; browser checks covered both languages, mobile
overflow, thumbnail scrolling, keyboard paging, viewer paging and trigger-specific
focus return. Exact feedback is in `gemini-controls-confirmation.txt` and
`gemini-polished-review.txt` in the task output directory.

The online build prerenders all 22 bilingual detail pages, with canonical URLs,
language alternatives, social metadata and sitemap entries. This work updates
the local 43187 preview only; it does not deploy the production website.

Validation: 13 focused tests, scoped ESLint and the online build passed. Browser
checks covered gallery-to-detail navigation, thumbnail selection, viewer paging,
Escape/focus return, language/page retention, filter-preserving return links and
light/dark appearances. Copy feedback was checked; automated clipboard reads use
a separate virtual clipboard, so they do not establish native clipboard contents.

2026-10-18 creation metadata follow-up: Gemini (`gemini-3.8-flash`) reviewed
Chinese desktop and English mobile screenshots with the open question
“这个作品详情页的布局合理吗？”. It found the split layout, mobile title ordering
and copy panel clear. It proposed a creation CTA, compact tags, mobile sticky
controls and an expandable prompt. Those are outside this change or conflict with
the owner's explicit compact-list / internally-scrolling prompt decisions, so none
were introduced. Its clipped-first-line observation came from a screenshot taken
after an internal scroll, not the initial state; the final desktop capture was
retaken and DOM-verified at prompt scrollTop 0. Suggested keyboard/swipe navigation
already exists. No new component change was made on the basis of this review.

Validation: 13 navigation, source-provenance and card tests passed, scoped ESLint
passed, and the online build prerendered 26 pages. Browser checks measured a 240px
prompt viewport with 1229px Chinese and 1909px English desktop content; mobile
English content measured 2489px inside the same 240px cap. Scrolling changed the
prompt scrollTop to 720 while page scrollY stayed 0. The copy button reported
success. The reference-image software work displayed its generation method and
inference disclaimer, with its shorter prompt naturally sized to 126px. Extraction
reruns hit all five cached results; invalid template input failed before API calls.


## Second-row curation and overview artwork

2026-10-18: the creator moved Quantum computing to fourth position and Money to
the first slot in row three. Desktop order is software / paper DeepSeek / Gen Z,
then quantum / SaaS pricing / food production, then money / Moutai / Xi’an. The
remaining blue DeepSeek and CNN follow. Money retains its original slide cover.

The second row now uses static bilingual 1600×900 overview WebPs, with the same
overview → slide → detail behavior as row one. Quantum gives its main slide the
most area, with three supporting pages and a restrained dark-blue tray. SaaS uses
a diagonal four-page composition on navy; the food-production report keeps all
four pages upright in a two-by-two layout on cool paper. Original slide images
are preserved; titles and annotations are composed in the existing brand fonts.
The six new assets are 96–162 kB each. Each card loads one image rather than
assembling several slides in the visitor’s browser.

`DeckOverviewArtwork.tsx` and `deck-overview.css` remain the editable source.
`scripts/cover-artwork.html` provides a development-only, fixed-size capture
surface, isolated from gallery card clipping. `encode-gallery-covers.mjs` accepts
optional deck IDs so adding covers does not re-encode existing approved assets.

Validation: six existing catalog/card tests and scoped ESLint passed; online build
and 26-route prerender completed. Browser checks confirmed the first six cards
use their bilingual overview WebPs, Money is seventh with `/gallery/money/1.webp`,
and Quantum advances from overview to slide 1 and returns to overview. English
mobile has no horizontal overflow and loads the corresponding English assets.
The temporary cover development server was stopped after export.

Gemini (`gemini-3.8-flash`) reviewed desktop and mobile with “这个画廊页面的布局合理吗？”.
It found the hierarchy and multi-page covers effective. Suggestions about uniform
page counters, mobile two-column layout, hidden arrows and filter fades were not
applied: those alter approved interaction/layout outside this request, and the
mixed overview/original-cover state is deliberate per the creator's instructions.
Full response and captures are in `outputs/banana-gallery-final/second-row-covers`.

## Homepage curved selected-work block

2026-10-18: polish the existing curved showcase without replacing its renderer or
in-place vertical reader. Default entries are the six catalog works with approved
overviews, in catalog order: software, paper DeepSeek, Gen Z, quantum, SaaS and food
production. Covers reuse the bilingual static WebPs; original slides appear only
when the reader is opened. A title link leads to the existing detail page, and the
heading link leads to the full gallery. These destinations are distinct from the
in-place reading action.

Keep the centered heading and curved visual identity. Remove the long instruction
sentence and redundant numeric deck counter. Consolidate arrows, six indicators
and a quiet autoplay icon beneath the active-work caption. Center the slide
vertically in a shorter stage, enlarge its mobile width and use subtle edge fades.
Fix the general landing-section grid rule overriding this block's display/spacing.
Pagination targets are 28×44px on mobile, with 44px arrow targets; the site's general
44px minimum width would otherwise push the controls beyond the viewport.

Autoplay pauses during reading, hover, focus, hidden documents and offscreen time;
reduced-motion preference disables it. Preserve pointer dragging and keyboard
navigation. Route horizontal trackpad gestures through the shared motion axis;
leave vertical homepage scrolling alone until the reader is opened. Schedule a
paint after native track scroll changes so anchor/focus restoration cannot expose
unpainted DOM covers behind the WebGL surface. Return-to-overview resets reading
progress. The optional cover source and language props retain existing defaults
for other consumers.

Validation: scoped ESLint, 12 catalog/motion tests and online build (26 prerendered
routes) passed. Browser checks confirmed all six localized WebPs load at 1600px,
mobile controls fit within 390px, keyboard switching/Enter reading, return to
overview, and the title link opening `/gallery/deepseek/`. Captures are saved in
`outputs/banana-gallery-final/curved-showcase` in the task workspace.

Gemini (`gemini-3.8-flash`) reviewed desktop and English mobile screenshots with
“这个首页作品展示区的布局合理吗？”. It found the desktop visual focus/spacing coherent,
but recommended fewer action entrances, a flat mobile carousel, and cleanup of the
surrounding experiment navigation and floating feedback button. These were not
applied automatically: replacing the curved experience exceeds this polish, the
three actions have distinct destinations, and the other experiment blocks/shared
feedback UI are outside this request. Mobile edge previews intentionally indicate
more works; full text is available through reading and detail views. No small
component was changed based on an unconfirmed model observation. Exact response:
`gemini-layout.txt` alongside the captures. This updates the 43187 local preview;
no production deployment or commit/PR was created.

### Copy and gallery CTA refinement

The owner requested a bottom gallery CTA and no separate slide-reading button.
Replace the slogan with “好想法，不止一种模样。” / “Good ideas take many forms.”
and identify these as real presentations made with Banana Slides. Move the gallery
link below the carousel controls, reusing `studio-button studio-button-dark`.
“点击总览，逐页浏览” is plain helper text; the overview itself remains the reading
trigger. Only the reading state exposes “返回总览”, preserving a touch-accessible
exit. Its line height matches the idle hint so the controls and CTA do not jump.

Scoped lint and online build passed. Desktop cover-click entered reading and
return restored the overview. The English mobile CTA navigated to `/en/gallery/`;
its copy and controls fit at 390px. The six overview assets and their order are
unchanged. Captures: `copy-cta-desktop.png` and `copy-cta-mobile.png` in the existing
curved-showcase output directory. No commit, PR or production deployment.

Gemini (`gemini-3.8-flash`) was asked “这版作品展示区的文案和操作层级怎么样？”.
It liked the factual subheading, but flagged similarity to the next experiment's
headline, the number of carousel controls, and suggested moving/weakening the CTA.
The CTA suggestion conflicts with the owner's explicit bottom-CTA direction and
was not applied. Adjacent headlines belong to alternative showcase experiments,
not sequential sections intended for the final page. No component was changed
from this feedback. Full response: `gemini-copy-cta.txt`.

### Owner-selected headline

The owner rejected broad slogans and the subsequent topic-by-topic headline, then
selected “快与美，并不矛盾”. Use that exact Chinese headline and “Fast can be beautiful.”
in English. Restore the concise factual subtitle: “用 Banana Slides 创作的真实作品。” /
“Real presentations made with Banana Slides.” The works provide visual evidence;
no speed statistics or additional performance promises are introduced. Preserve
the bottom gallery CTA and non-button cover-click hint. This supersedes the prior
copy directions in this document.

## Homepage detail-link transition and return origin

2026-10-18: remove the caption's separate reading hint. Only the existing
return-to-overview control remains while reading. The title's detail link now
carries `from=home`; detail pagination and language changes retain that marker.
Its top-left link says “返回主页” / “Back to home” and returns to `#works-curved`.
Gallery-origin links retain their filtered gallery return destination. The related
section's “all presentations” link still goes to the gallery.

Use native cross-document View Transitions on this specific homepage link. A
temporary snapshot of the centered artwork shares `deck-artwork` with the detail
preview: 620ms position/scale interpolation, followed by an overview-to-first-slide
crossfade. The surrounding homepage fades out in 180ms; detail information fades
in after a 220ms delay. The public prerender head loads the small lifecycle script
synchronously so its pagereveal listener runs before first rendering. No router,
editor bootstrap or production service settings were changed. Ordinary links,
modified/new-tab clicks, unavailable APIs and reduced-motion preferences keep
normal navigation. Temporary snapshot/opt-in styles are removed after arrival and
on bfcache restoration. The DOM data-deck-transition state exposes native ready /
finished / skipped status for verification.

Validation: five detail-navigation/provenance tests, scoped lint, JS syntax and
26-page online build passed. Real browser navigation reported native transition
finished on Chinese desktop and English 390px mobile. Verified homepage return,
slide-2 origin retention, direct-detail gallery return, absent reading hint, no
mobile horizontal overflow and reduced-motion normal navigation. Evidence is in
`outputs/gallery-detail-transition` in the task workspace. Local 43187 preview
updated; no commit, PR or production deploy created.

### Caption follows reading expansion

The owner requested the work caption close to the cover at rest, moving down
smoothly only when the inline reader opens. Reuse the stage's cover/preview
geometry at section scope: the default caption sits 14px below the central 16:9
cover, inside the side cards' lower overscan area. In reading mode it moves below
the full reader aperture. Its margin and the return-action grid row animate for
420ms with cubic-bezier(.22, 1, .36, 1), so the controls/CTA follow in normal flow.
Closing reverses the same transition; reduced motion disables it. The collapsed
return action is clipped, aria-hidden, disabled and outside the tab order.

The work-detail link now uses the existing Lucide ArrowUpRight at 15px. Carousel
navigation retains left/right arrows. Preserve the existing DeepSeek default,
centered-caption synchronization and `?from=home` navigation provenance.

Validation: scoped lint and online build passed. Browser measurements: resting
cover-caption gap 14px at both 1280px and 390px; reading gaps 73px and 43px,
respectively. The return action expands from 0 to 36px (44px mobile). An in-flight
margin sample was 12.559px before reaching the 14px endpoint. Mobile had no
horizontal overflow; opening and closing worked in Chinese and English. Captures
`caption-idle.png` and `caption-reading.png` are in the curved-showcase outputs.

### Correction: visibly controlled detail handoff

2026-10-18: the creator observed an immediate jump despite the previous native
transition reporting completion. Replace that implementation: browser lifecycle
completion was insufficient visual evidence, and its idle-only guard could bypass
the effect. The homepage now intercepts only the ordinary detail-title click and
mounts the existing detail component through the same React root. No full-document
navigation can interrupt the authored sequence. A temporary cover above the root
survives a 160ms homepage fade, then moves/scales to the actual detail preview's
measured rectangle over a 760ms sequence. The first slide crossfades beneath it at
the end; the surrounding detail content enters after 200ms. Completion awaits Web
Animations promises, not a navigation timeout. Native links remain for modified
clicks, reduced motion and loading failures. Back/forward to the homepage restores
the normal route, and from=home continues to control the return label.

Removed the obsolete public cross-document lifecycle script/styles and their head
injection. The new navigation module is loaded only with the marketing homepage;
editor entry and other link behavior remain untouched. Current parent-thread copy,
carousel controls and reading behavior are preserved.

Verification captured actual intermediate frames and measured changing proxy
coordinates/widths, not only a finished status. Confirmed final proxy cleanup,
Chinese desktop and English mobile completion, no mobile overflow and browser Back
returning to /#works-curved. Scoped lint, five navigation/provenance tests and the
online build passed. Images are in outputs/gallery-detail-transition, including
visible-flight-* and final-flight-*.

### Crossfade during travel, ready on arrival

2026-10-18: preload and decode the six featured decks' first slides when the
homepage showcase mounts. Navigation resolves the actual destination slide from
the catalog and URL, reusing those decoded images. A single moving container holds
both the overview and destination slide: their opacities crossfade together from
60–380ms of the 700ms movement. The destination image is fully visible before
arrival. The detail preview remains hidden underneath until the moving container
is removed; there is no second fade or image substitution after arrival. Loading
failures retain the normal navigation fallback, and reduced motion keeps its
existing native-link behavior.

Validation: scoped lint, five navigation tests and the online build passed.
Actual browser frames showed incoming/outgoing opacity 0/1, then .807/.193,
then 1/0 while position was still moving; the final preview was decoded and the
temporary container removed. Evidence: gallery-detail-transition/crossfade-*.png.

### Lightweight homepage carousel and instant return

2026-10-18: the featured six-deck strip now renders its existing WebP images
directly. Reuse the established drag/inertia/keyboard motion axis and inline
reader, with modest CSS scale and perspective on adjacent covers. The homepage
does not create a canvas or initialize WebGL. The separate experimental gallery
renderer is unchanged.

Entering a detail page retains the mounted homepage, inert and hidden at its
existing width, while a separate React root displays the detail. The selected
deck, inline page, decoded images and scroll position survive. Returning or using
browser Back restores that same page synchronously; there is no page reload,
white interstitial or re-entry fade. Browser Forward remounts the detail without
discarding the home state. Autoplay is paused while home is inert. Shared theme
controls stay synchronized, and only the visible route owns document metadata.
History scroll restoration is temporarily manual during return so native
restoration cannot overwrite the recorded position. The authored forward
movement/crossfade remains, with an immediate reduced-motion path.

Validation: scoped lint, 15 motion/navigation tests and the 26-route online build
passed. Browser checks found zero homepage canvases, retained Gen Z slide 2 after
return, and an exact 1785px scroll restoration. Checked page return, browser
Back/Forward, English at 390px, theme synchronization, reduced motion and no
horizontal overflow. Return screenshots show the images on the first captured
frame; evidence is in gallery-detail-transition/return-dom-* and return-mobile-en.

### Restrained curved showcase

The owner approved reducing the existing curve instead of replacing the carousel.
Keep the original gallery renderer profile unchanged for other consumers. The
homepage showcase opts into a restrained profile: centered artwork is unchanged;
side works smoothly shrink to 90%, fade to 82% opacity, and use a .10 desktop / .04
mobile bend rather than .55 / .20. Shrink and opacity follow continuous smoothstep
position, so passing the center does not toggle visual states abruptly. Inline
reading pages keep full opacity. The unavailable-WebGL fallback also scales and
dims neighboring covers.

Narrow the edge fade from 9% to 2.5% on desktop and 4% to 1.5% on mobile. Mobile
stage bleeds 12px into each gutter and uses an 8px gap to retain adjacent-cover
peeks after scaling, without shrinking the selected work. The footer gallery CTA
is now a text link with a 44px hit height, an understated yellow hover underline
and a 3px arrow movement; reduced-motion disables that transition. Keep the exact
approved headline, initial DeepSeek selection, six covers, title's up-right arrow,
14px resting caption gap and 420ms reader-expansion motion. No outer frame or
metadata strip was added.

Validation: scoped lint, online build and all 10 geometry/motion tests passed.
The added geometry test checks unchanged center, smaller side widths, restrained
visible edge height and mirrored behavior at desktop/mobile sizes. Browser checks
covered opening/closing the reader, animated caption placement, transparent CTA,
English mobile width and adjacent-cover visibility without horizontal overflow.
Captures: `restrained-desktop.png` and `restrained-mobile.png` in the existing task
output directory. No production deployment, commit or PR.

Gemini (`gemini-3.8-flash`) reviewed both captures with “这版首页作品展示区的视觉层级合理吗？”.
It still considered the purple side work attention-grabbing and proposed stronger
0.5–0.6 opacity, a title overlay, removing mobile arrows, relocating the gallery
link, and larger section spacing. No further changes were made from that review:
the approved pass calls for slight recession and a narrow edge fade, preserving
artwork color and existing caption/reader behavior. Overlay titles and moving the
bottom link contradict the owner's pinned interaction/CTA placement. The claimed
CTA/next-heading collision is not present in the capture (roughly 100px separates
them). Exact feedback: `gemini-restrained.txt`. These are recorded observations,
not an endorsement of the final design or instructions to broaden this change.

### Caption and gallery link hierarchy

The work caption is supporting identification: 14px regular secondary text with a
13px up-right arrow, consistent on desktop and mobile. The bottom gallery link
is the section's next action: 16px medium ink text, retaining its 44px hit area
and understated hover treatment. Reduce its gap from the controls to 18px. Keep
caption placement and reader expansion motion unchanged.

The bottom gallery entry is text-only in both languages, per the owner's follow-up.
Remove its right arrow and obsolete arrow motion; retain the link's type, hit area
and hover underline. Carousel navigation arrows remain unchanged.

### Use a gallery style in the demo

Place a compact, shared `studio-button-dark` link between the metadata and prompt,
labelled “前往使用” / “Use this style”. Keep the metadata and CTA together on tablet;
mobile stacks them before the prompt. Reuse the existing app TextStyleSelector.
The link opens `/app?galleryStyle=<published-id>&styleLanguage=<zh|en>` in the same
tab. Resolve the complete prompt from the published manifest, so the URL stays
short and no clipboard permission or arbitrary URL-supplied prompt is involved.
Both original presets and clearly labelled inferred prompts use the displayed
language. This supplies text only; it does not recreate a reference-image workflow.

On a valid entry, initialize text-style mode, scroll to and focus the existing
editor, and defer the first-visit help popup so it does not cover the requested
editor. Preserve the topic draft. Normal/unknown entries retain their existing
behavior. Nothing generates a project automatically. Refreshing this explicit
entry reapplies the selected published prompt, matching a fresh visit.

Validation: 11 tests cover all published bilingual prompts, invalid IDs, real Home
and TextStyleSelector mounting under StrictMode, focus, continued editing and
preserved topic drafts. Scoped lint and online build passed; desktop and English
mobile UI checked without horizontal overflow. The preview's existing
`/api/public-config` returns HTTP 500, so the browser click reaches the correct
Demo URL but AppBootstrap cannot mount the editor in this environment. Component
verification is not a claim of a working end-to-end backend connection.

Design-hook findings concern the existing Demo logo/hero gradient text; retain
that existing application design under the owner's reuse requirement. No hook
suppression or unrelated redesign was added.

Gemini reviewed desktop/mobile captures with “这个作品详情页的布局合理吗？”. It
considered the two-column structure and metadata clear, suggested a larger CTA
and sticky mobile action bar. Keep the compact shared button for this scoped
entry addition; no extra fixed layer. Its copy-button border observation is the
keyboard focus ring in the test capture, and prompt height already caps at 240px.
Do not apply those screenshot-only suggestions as confirmed defects. Full review:
`outputs/banana-gallery-final/style-handoff/gemini.txt` in the task workspace.

Owner refinement: “前往使用” was too visually heavy. Replace the solid CTA with a
14px medium ink text link and faint underline, highlighted in brand yellow on
hover. Retain the 44px click height, keyboard focus treatment and existing handoff.
The lightweight use-style link retains a 14px up-right arrow with a 6px gap,
as explicitly requested; this does not restore the solid button background.

Final placement: group the lightweight “前往使用 ↗” / “Use this style ↗” link
immediately before Copy in the prompt card heading. Both actions use 12px text;
the use-style action retains its arrow and faint underline. Keep provenance alone
in the footer and preserve the metadata-to-prompt spacing and tablet grid.
Allow the heading group to wrap on exceptionally narrow screens without splitting
the paired actions. Mobile controls retain the shared 44px touch target.

## Gallery-to-detail handoff

Gallery covers share the homepage handoff implementation. The clicked cover stays visible while the source page fades for 160 ms, then translates/scales to the detail preview over 700 ms. The overview crossfades into the selected slide after both images decode. The detail preview is hidden only while the overlay occupies its place. Reduced-motion mode skips the durations.

The document body inherits the marketing theme's canvas color without the app's
background transition. Both fading roots reveal this canvas, so theming only the
root containers or html exposes the app's light body background in dark mode.
This override is scoped to data-landing-theme and leaves application theming intact.

The parked source root also has opacity: 0. Homepage reader peeks explicitly use
visibility: visible, which overrides an ancestor's visibility: hidden and leaks
cropped image strips into the detail page. Root opacity suppresses the entire
subtree while retaining measurements and the reader state for Back/Forward.
Regression coverage must include entering a detail from an expanded homepage
reader, scrolling past the footer, then returning to that same reader.

Keep the gallery mounted but inert during detail viewing, preserving filters, page selections and scroll position. Back restores that instance and its metadata; browser Forward remounts the detail. Only source-gallery covers are intercepted, so related works, modified clicks and direct detail URLs retain normal link behavior. Cancellation guards prevent a previous transition from clearing a new transition's styles.

Validation: desktop frame sampling found no undecoded image in the handoff; source/departing/moving/finished phases were observed. Also check filtered navigation, history Back/Forward, mobile and reduced motion before release.

## Loading performance — Impeccable closing pass

Measured cold browser loads before choosing changes. The shared website header was loading a 2048px, 1.84 MB PNG for a 32px logo; it now uses a 128px, 2.8 KB WebP. Original source artwork remains intact. Gallery overviews offer 800px/1600px sources with sizes matching the actual grid breakpoints. Thumbnail strips use 320px derivatives; preview, paging and full-screen views retain original slide resolution.

The homepage lazily loads offscreen covers and preloads only the selected first slide when the showcase approaches the viewport (400px margin), instead of fetching six full slides on mount. Existing decode-before-transition behavior remains in place. Asset generation is documented in README and uses the existing cwebp tool.

Cold local browser resource transfer (cache disabled, same viewport per comparison):
- Mobile homepage: 4.29 MB → 1.73 MB (60% less).
- Desktop gallery: 4.24 MB → 1.86 MB (56% less).
- Desktop 16-slide detail: 5.26 MB → 1.39 MB (74% less).

These are lab resource measurements, not production network timings or field Core Web Vitals. Observed CLS stayed at 0–0.001. Confirmed mobile at 390px/DPR2 with 100ms latency and 500KB/s throttling: no horizontal overflow, full-resolution detail image after the cover transition, and thumbnail clicks load the corresponding original slide. Existing typography, copy, controls and composition were retained.


## Slow connections and private presentation submissions

Keep the gallery useful while images arrive: reserve each 16:9 frame, use a
low-contrast themed shimmer, retain the overview until the first slide decodes,
and retain the previous slide during later page changes. A delayed, small loading
label explains a slow slide or detail handoff. Reduced motion disables shimmer.
An upload is not optimistic: 100% means bytes sent; success follows the server's
validation and durable-save acknowledgement. Failed requests retain the file for
retry; identical visitor/file retries are deduplicated.

The owner's final direction is a centered end-of-page invitation with illustration,
heading, one short sentence and “提交作品 ↗” / “Share your presentation ↗”. There is
no inline upload form. Reuse Footer and its existing ribbon; put the invitation in
its optional content slot, leaving every other page's footer unchanged. Use a
small ivory-slide/yellow-paper-plane illustration, generated with Imagegen and
optimized to a 480px transparent WebP (about 17 KB), rendered at 200px desktop /
168px mobile and loaded lazily. Keep the text action secondary to global Demo.

Clicking the invitation opens the existing Base UI marketing dialog. Reuse its
focus trap, Escape, theme and close control; return focus to the invitation.
The upload surface references 21st's Joyco File Dropzone:
https://21st.dev/@joyco/components/file-dropzone
Its preview and component source were inspected. Adapt the restrained dashed
surface, file metadata/removal and inline error pattern to one PDF and the
existing private backend; do not import an unrelated hosting provider or a fake
progress timer. Preserve selected file/progress if the dialog is closed/reopened.

Gemini review used gemini-3.6-flash-low. Initial question: “这个作品画廊的页尾邀请区布局合理吗？”
The full-page capture did not show the footer correctly to the model; its claim
that the invitation/footer was absent was contradicted by the live page. Follow-up
with the checked viewport capture: “这是页尾邀请区的近景截图。你看到的区域是什么？这里的布局合理吗？”
It correctly identified the submission CTA and footer, found the vertical hierarchy
and placement reasonable, and suggested a stronger yellow button and more spacing.
Keep the owner's lightweight secondary action; measured separation from cards is
already generous. Its yellow-edge concern is the existing custom scrollbar, with
no horizontal overflow. Do not change shared footer navigation for this task.
Review outputs and screenshots: task workspace outputs/gallery-submissions/.

Validation: 33 frontend regression tests, 26 backend/public-demo/migration tests,
online prerender build and ESLint (zero errors; nine existing warnings). Browser
submission rejects an unmarked PDF, accepts an actual app-exported three-page PDF,
and the authenticated admin can view page 2 and download byte-identical original
content. Closing the dialog restores focus. Checked dark/light and narrow layouts.
At 3s latency / 25 KiB/s, the first slide remains covered by the loaded overview
with a loading label until decoding completes, then reveals the slide. Network
throttling is reset after testing. These changes are local, not deployed.

### Navigation without image remounts

Normal-speed Chrome exposed a separate flash: `createRoot` discarded the entire
static page once JavaScript arrived. Instrumentation measured 0/13 retained images
on Gallery before the fix. Marketing entries now hydrate the existing DOM; the
development shell still uses createRoot when empty. Chrome retains 13/13 Gallery
images and 19/19 homepage images after hydration. Cached images reconcile their
completed/error state even when their native load event preceded React.

Browser-only state (theme, URL filters, requested slide) restores after the first
matching hydration render. Keep the head-applied theme throughout; unmounting a
detail must not clear a document-wide theme. Already-visible prerendered sections
must not become transparent and replay an entrance animation on JS startup.
The Gallery/detail enlargement and crossfade remain, with the source DOM retained
for return navigation. Regression coverage checks DOM identity, cached readiness,
dark theme, query filters, slide selection and return destination.

History return has a separate pre-paint requirement: restoring images alone does
not prevent a document from briefly showing its top before native scroll recovery.
The prerendered head now installs a small, self-contained scroll bootstrap. Save
the current position on the departing history entry (preserving other state),
then restore it synchronously after the static body is parsed, before revealing
the root. Direct section links use the same path. New homepage visits remain at
the top, and bfcache restores do not replay an obsolete initial position. This
does not wait for React, fonts, a timer or a transition. Six regression cases
cover restoration ordering, state preservation, anchors, fresh visits, bfcache
and missing targets. A Chrome Gallery→Back capture retained the work-section
viewport in every sampled frame, with the hero above the viewport throughout.

### Continuous reader wheel surface

The in-place reader handles wheel input across its entire viewport, including
the 16px gaps between slides. Individual image bounds must not let wheel events
leak through to document scrolling. Input outside the viewport and pinch zoom
remain native. Chrome verification: a wheel gesture in the gap advanced slide
1 to slide 2 while document scrollY stayed at 1635.5; regression tests cover
gap input, outside bounds and Ctrl+wheel.

Horizontal dragging translates the reader without reducing its opacity. Keep
the slide legible during its rewind; completion hands back to the cover without
waiting for horizontal selection to settle. Chrome confirmed
opacity 1 at a 180px drag offset and normal overview selection after release.

### Overview as page zero

The homepage reader includes the localized overview WebP as page 0, followed by
all original slides (1…N). Entry begins on that same overview and advances along
the belt to slide 1. Horizontal rewind targets the nearest page-0 slot in the
N+1 cycle; adjacent pages remain visible throughout instead of being hidden
when a drag begins. The overview and slides share identical image dimensions
and corner treatment. Returning explicitly waits for page 0 before unmounting
the reader, so the resting cover matches the outgoing image. The actual deck's
page count and detail-page numbering remain unchanged.

Checked in Chrome: entry, drag back to page 0 at full opacity, selection after
release, and animated Back to overview. Four reader regression tests cover gap
input, browser scrolling/zoom, the N+1 cycle and the return handoff.

### Interruptible reading and selection

Reference: emilkowalski/skills, commit
`2d228630ba1446365f614a108cb8252f1feda202`, particularly
`skills/apple-design/SKILL.md`, `skills/review-animations/STANDARDS.md` and
`skills/animation-performance/SKILL.md`. These are design guidance, not a carousel
implementation. Apply their interruptibility and presentation-state principles
to the existing reader rather than replacing its visual design.

Reading intent is independent of horizontal settling. Click or keyboard input
opens the selected cover immediately while horizontal centering finishes.
Vertical wheel input never opens a cover: it scrolls the document unless it is
inside an already-expanded reader, including its inter-page gaps. Each reader
session owns its progress; stale completion
callbacks cannot close a newer session. A returning reader accepts new input
from its current position, and cancelled springs cannot complete an old exit.

Keep the page-zero belt and full-opacity horizontal rewind. Use a near-critically
damped spring for rewind, inheriting vertical velocity, rather than restarting a
fixed-duration easing. Horizontal snapping starts below 30 CSS px/s (previously
3); vertical snapping starts below .12 pages/s (previously .012). The spring
shortens the low-speed tail without adding an input lock. Keyboard page changes
are immediate; unrelated keys do not interrupt a return. Only the primary pointer
can take control. Page and reader translations use full transform strings.

Validation: 18 targeted tests cover motion settling, page-zero cycling, gap input,
independent sessions and stale exits. Chrome checks cover drag then immediate
click/wheel and wheel interruption during Back to overview. No document scrolling
occurred during reader wheel takeover. This is local interaction validation,
not a measured frame-rate guarantee or a real-device touch certification.

### Slide preview handoff without a background flash

The detail thumbnail transition must retain an opaque backing image until the
incoming image has both decoded and completed its fade. Decode completion alone
is not the handoff: Chrome previously captured the outgoing DOM node removed
while the only remaining image still had opacity 0. Explicit retained layers now
replace AnimatePresence exit timing. Interrupted fades keep their visible layers;
only the newest completed fade may discard them. Unseen cancelled requests are
removed immediately. The shared SlidePreview applies this to gallery cards too.

Validation: ten card, preview and hydration tests passed. Chrome took 25 DOM samples
during a dark-theme thumbnail change with combined layer coverage always 1, then
rapidly selected slides 1→3→2→4→5 with the same result. The final incoming layer
remains mounted when prior layers are removed. Online prerender build passed.

### Loop-copy visibility during side entry

The carousel renders three repeated sets of covers. Reading selection must use
the deck index modulo the deck count for every copy, not only the middle set.
Otherwise clicking the right neighbor at the last→first boundary mounts the
reader over a still-visible cover; it shows through page gaps and the viewport
mask while moving inward. All copies of the reading deck now share selected
visibility, while duplicate sets remain hidden from accessibility. The simultaneous
horizontal centering and vertical expansion behavior is unchanged.

Chrome reproduced the faulty boundary with a visible outer software cover while
its off-screen middle copy was hidden. After the fix, all three copies are hidden
throughout the sampled inward movement. Verified last→first, first→last and an
ordinary right-neighbor entry, with exactly one reader mounted. Eleven targeted
tests, scoped lint and the online build passed; the local preview was rebuilt.
