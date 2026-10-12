# Waymark scrolling header

Reference: https://waymark-template.vercel.app/ (inspected 2026-10-12).

Original TSX was not available in this workspace; the complete template is a paid product. This is a React/Vite port of the header mechanism from its publicly served JS/CSS, not an unmodified upstream source component.

- SiteHeader module 78448: `/_next/static/chunks/app/(site)/layout-45e80a589d2fb1bf.js`
- Styles: `/_next/static/css/a041134804a91b31.css`
- Preserved: 800/1152 target scale, inverse scaling of content, compensated 24px corner radius, 85% white glass, 24px backdrop blur, subtle border, 8px top clearance.
- Navigation hover uses the original shared highlight and spring (stiffness 360, damping 32, mass 0.6), with immediate first entry/keyboard focus and reduced-motion support. It is enabled for both expanded and compact headers; link padding fits the existing navigation spacing. On entry the fill fades and scales from 0.82 to 1 over 180ms, without increasing its final bounds.
- Motion revision: scrolling past 24px triggers independent height and width transitions. Height settles to 52px over 320ms; width eases over 650ms. Glass fades in only once height is 98% settled, and disappears before expanding. This keeps the transition gentle without exposing the original tall glass panel.
- Adaptations: Next links replaced with existing React navigation; existing first-screen appearance retained; 52px compact height with vertically centered controls; minimum width measured from our longer navigation and action groups; existing mobile navigation visibility retained; anchor offset and reduced-motion support.

No remote runtime dependency or purchase was introduced.
