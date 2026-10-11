# Tailark Call To Action 3

Source: https://github.com/tailark/blocks/tree/28d0cd694ef3b6b29dcba7d7651d8f8e934f6a87

- `CallToAction.tsx`: `packages/dusk-kit/blocks/call-to-action/three/index.tsx`
- `Button.tsx`: `packages/core/ui/button.tsx`
- Copyright and MIT terms: `LICENSE`.

Integration changes: resolve Button and cn imports locally; expose copy, form events,
input attributes, disabled state, section identity and footer content as props;
mark decorative icons as hidden from assistive technology; replace Tailwind 4's
`rounded-(--radius)` with Tailwind 3's `rounded-[var(--radius)]`.
The original layout and Button dependency are retained. Brand styling is scoped
in `landing-cta.css` because this project uses different semantic theme tokens.

2026-10-11: Added a beforeForm slot and optional description to support the requested Demo-first CTA. The existing form and input/Button implementation remain intact; signup context is supplied via the footer slot.
