# Landing fonts

These are the exact WOFF2 files approved in the local Landing preview, now bundled by Vite so release builds preserve the typography.

- `landing-rounded.woff2`: 资源圆体, copyright Cyano Hao / portions Adobe; see `Rounded-OFL.txt`.
- `landing-nunito-sans.woff2`: Nunito Sans, copyright The Nunito Sans Project Authors; see `NunitoSans-OFL.txt` (from https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/OFL.txt).

Both use the SIL Open Font License 1.1. CSS family aliases scope their use to Landing and its feedback dialog. Chinese uses the rounded font; Latin characters and digits use Nunito Sans. No external font service is required.

## Delivery subsets

`npm run fonts:landing` regenerates three disjoint subsets of the rounded face and their CSS `unicode-range` declarations:

- `landing-rounded-latin.woff2`: shared Latin characters, symbols, and the Chinese brand used in the English footer.
- `landing-rounded-ui.woff2`: Chinese homepage copy, shared controls, and gallery titles.
- `landing-rounded-extended.woff2`: remaining known gallery and UI characters, fetched when the page uses them.

The original font remains the fallback for characters outside the known source corpus. All subsets preserve the `wght` and `ROND` axes and shaping features; this is a delivery change, not a replacement typeface or a fixed-weight conversion. Headings retain their existing rounded face while Latin body copy retains Nunito Sans.

The split avoids downloading long gallery descriptions on the homepage. At the initial split, total homepage font bytes fell from 609,440 to 371,196 for Chinese and 75,176 for English. Pages needing every subset can transfer about 39 KB more than the former single rounded subset; navigation reuses already cached subsets. Keep that tradeoff visible when adding new content.

The homepage group comes from shared landing sources, homepage gallery components, and manifest titles. New characters remain available through the extended or original fallback even when a new component is not in the homepage group; check network font requests when moving content onto the homepage. Do not remove glyphs or freeze variation axes to reduce transfer size.
