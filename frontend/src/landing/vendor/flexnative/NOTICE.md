# Flexnative components

Source: https://github.com/felipemenezes098/ui-flx
Commit: 8bc30df9a0cbd0967f6256001fe559f4c1b1cf87
Author: Felipe Menezes / Flexnative. License: AGPL-3.0 (see LICENSE).

Content06 and Feature01 are copied from the registry, with their original Button, Cta and utility dependencies. Layout, selection and motion logic are retained.

Local integration changes: import paths; Content06 uses h3 under the Landing h2 and accepts an optional React media slot for the existing product illustration; Feature01 accepts a translated navigation label and hides inactive descriptions/images from assistive technology. Brand typography, color, slide aspect ratio and Tailwind 3 compatibility are scoped in template-sections.css.

2026-10-11: Feature01 also accepts a React media slot to reuse the Landing's original SVG illustrations, which its image-only API could not render. Original selection and crossfade logic are unchanged.
