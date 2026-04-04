# FEIYE Branding Strategy

This fork keeps FEIYE-specific branding changes isolated so upstream updates can be merged with less friction.

## Goals

- Keep FEIYE brand colors and decorative styles in a dedicated brand layer.
- Minimize direct edits to upstream page structure and business logic.
- Make the branch flow predictable:
  `upstream/main -> main -> feature/feiye-branding -> deploy/tencent`

## Brand Layer

The FEIYE visual system now lives primarily in these files:

- `frontend/src/styles/feiye-brand.css`
- `frontend/tailwind.config.js`
- `frontend/src/main.tsx`

### Why this helps

- `feiye-brand.css` overrides theme tokens in one place instead of scattering hex values across many components.
- Shared semantic classes such as `feiye-page-shell`, `feiye-title-gradient`, and `feiye-soft-gradient` reduce repeated color decisions.
- Most page-level changes are now class swaps, which are easier to reapply after upstream merges than large visual rewrites.

## Current FEIYE Palette

Primary brand family, extracted from `frontend/public/feiye.jpg`:

- `banana-500`: `#6C9F97`
- `banana-600`: `#568781`
- `banana-700`: `#456E68`
- `banana-800`: `#345652`
- `banana-900`: `#223A36`

Supporting light surfaces:

- `banana-50`: `#EEF7F5`
- `banana-100`: `#DCEEEA`
- `banana-200`: `#BEDDD6`
- `banana-300`: `#9BC7BF`
- `banana-400`: `#7DB3AA`

## Files Intentionally Touched

Brand-facing pages and surfaces only:

- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Landing.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/shared/HelpModal.tsx`
- `frontend/src/components/shared/MaterialGeneratorModal.tsx`

These files use FEIYE semantic classes instead of introducing more hardcoded brand colors.

## Files Intentionally Left Alone

To stay upstream-friendly, we avoid unnecessary edits to:

- backend logic
- routing structure
- API contracts
- data models
- most component behavior
- warning/error/info semantic colors

Functional status colors still keep their semantic meaning even if they are not FEIYE brand colors.

## Branch Layering

Recommended responsibilities:

- `main`
  Mirrors upstream as closely as possible.
- `feature/feiye-branding`
  Contains FEIYE branding only.
- `deploy/tencent`
  Contains deployment/runtime changes only, and should sit on top of `feature/feiye-branding`.

That means `deploy/tencent` should not become a second branding branch.

## Update Workflow

1. Fetch and fast-forward `main` from `upstream/main`.
2. Rebase `feature/feiye-branding` onto the updated `main`.
3. Rebase `deploy/tencent` onto `feature/feiye-branding`.
4. Push `feature/feiye-branding` and `deploy/tencent`.
5. Redeploy the server from `deploy/tencent`.

This keeps the branch stack linear and makes conflicts easier to understand.

## Automation

Use:

- `scripts/sync_feiye_branches.sh`

It automates the branch layering above and is intended to be run locally before redeploying.

## Maintenance Rules

When future FEIYE brand tweaks are needed:

1. Prefer editing `frontend/src/styles/feiye-brand.css` first.
2. Only touch page/component files when structure or class hookups must change.
3. Prefer semantic FEIYE classes over raw `yellow/orange/pink` utility colors.
4. Keep deploy-specific fixes out of `feature/feiye-branding`.

## Quick Check After Upstream Merge

- Verify `frontend/src/main.tsx` still imports `./styles/feiye-brand.css`.
- Verify `frontend/tailwind.config.js` still contains the FEIYE `banana` palette.
- Search for newly added upstream hardcoded brand colors:

```bash
rg -n "from-yellow|via-orange|to-pink|text-yellow|text-orange|bg-yellow|bg-orange" frontend/src
```

- Search for FEIYE semantic classes still in use:

```bash
rg -n "feiye-page-shell|feiye-title-gradient|feiye-soft-gradient|feiye-accent" frontend/src
```
