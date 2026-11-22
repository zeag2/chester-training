# PalDex (chester-training)

Start with `docs/HANDOFF.md`.

## Handoffs
- When updating `docs/HANDOFF.md`, always keep **section 7, "Skills, plugins and tools"** current: every skill,
  plugin and MCP server that is installed, removed or used for real work, with its source, the date and what it was
  used for. Put it in the same commit as the change.
- Josh wants this in the handoff of **every** project, not just this one.

## Design system (`docs/design-system.md`)
- New screens use existing components and tokens (`src/styles/tokens.css`) only; no literal colours, sizes, spacing or radii.
- Anything new goes into the design system first (doc + tokens), then into screens. No second button style.
- Tabs for exclusive equal views (up to 5–7), accordion for progressive disclosure and narrow screens, a table when comparing values.

## Working here
- `npm test`, `npm run typecheck`, `npm run build` before pushing. Pushes to `main` deploy to GitHub Pages.
- Supabase SQL is run by Josh by hand; keep migrations idempotent and paste them into chat.
