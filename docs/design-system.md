# PalDex design system

The design doc for PalDex. New screens and changes follow it; anything it doesn't cover gets added here first.
Phase 1 (this doc) names the direction and the tokens. Phase 2 moves the code onto them (see the end).

## Constraints (Josh)
- **One named aesthetic direction, committed.** Never "modern and clean".
- **No Inter, Roboto or system fonts** as the face (system fonts only as a last-resort fallback in the stack).
- **No purple or indigo gradients.** No centered three-card hero.
- **Hierarchy from type and space,** not borders and boxes everywhere.
- **Real, specific content only:** Chester, Luna, "Fed 1 of 2 · 7:40 by Megan". No lorem ipsum, no "Item 1".
- Obey this doc.

## Direction: **warm-minimal, "kitchen-table notebook"**
A warm, quiet notebook kept by the food bin. Soft paper and ink, a few pastel washes the colour of cat-care
things (butter, mint, peach, sky), one rounded friendly sans, big confident headings, generous space. The cat is the
only illustration. Colour marks *kind* (mint = done or healthy, peach = attention, butter = treats and rewards, sky =
planning and vet), never decoration, and never the only signal (always with an icon or words).

What it is not: no gradients, no glass, no drop shadows beyond the one soft card shadow, no outlines around everything,
no neon.

## Type
| Role | Font | Weight | Size / line height | Use |
|---|---|---|---|---|
| Display | **Nunito** | 800 | 34 / 38, letter-spacing −0.5px | screen titles ("Chester's health") |
| Heading | Nunito | 800 | 20 / 26 | section heads ("Visits", "Log something") |
| Title | Nunito | 700 | 16 / 22 | card and row titles |
| Body | Nunito | 400 | 16 / 24 | sentences, form values |
| Small | Nunito | 600 | 14 / 20 | sub-lines, chips |
| Label | Nunito | 800 | 12 / 16, uppercase, +0.6px tracking | "YOUR VET", "NEXT" |
| Numbers | Nunito, `font-variant-numeric: tabular-nums` | 700 | as context | weights, counts, times |

- **One family:** Nunito (Google Fonts, 400/600/700/800, already loaded). It's rounded and friendly, readable at 14 px, and it
  suits the cat. The stack is `Nunito, "Avenir Next", sans-serif` (drop `system-ui`).
- Hierarchy comes from **size and weight jumps** (34 → 20 → 16), not from colour or boxes. There are only five sizes: 34, 20, 16, 14, 12.

## Colour tokens
Keep today's values (they're tuned and tested for contrast); give them roles and names. **Light / Dark**:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | #ffffff | #141513 | page |
| `--surface` | #ffffff | #32332e | raised card, sheet field |
| `--ink` | #232320 | #f1f0ea | text, primary button |
| `--ink-2` | #3a3a36 | #d6d5ce | secondary text emphasis |
| `--muted` | #6a6a64 | #a6a69e | sub-lines (≥ 4.5:1 on bg) |
| `--muted-2` | #8a8a84 | #8f8f88 | placeholders, disabled only |
| `--line` | #eeeeea | #34352f | hairlines, the card edge |
| `--grey` | #f4f4f1 | #1f201d | quiet fills (secondary buttons, inputs) |
| `--on-ink` | #ffffff | #141513 | text on `--ink` |
| `--mint` / `--teal` / `--teal-ink` | #e6f3ee / #2a7a6f / #1d5a52 | #1c2c27 / #6cc3b5 / #a3ddd1 | done, healthy, links |
| `--peach` / `--rose` / `--peach-ink` | #fdede5 / #c2563f / #6e3424 | #33231d / #e58a74 / #f1bba6 | attention, warnings, delete |
| `--butter` / `--butter-ink` | #fbf3d8 / #5b4a1c | #2d2918 / #e9d79a | treats, rewards, toasts |
| `--sky` | #e7effa | #1c2333 | planning, vet, friends |

Rules: a wash colour (`--mint`, `--peach`, `--butter`, `--sky`) is a **card background** with its `-ink` text; never two washes
next to each other in one card. `--rose` is for destructive text and the emergency call only.

## Space, shape, depth
- **Space scale** (px): 4, 8, 12, 16, 20, 24, 32. The screen gutter is 20 on a phone. Sections are 24 apart, cards 12, inside a card 8–12.
- **Radius:** 8 (small chips inside cards), 14 (rows, inputs, small tiles), 22 (cards), 26 (sheets), 999 (pills: buttons, chips).
  That's 5 values. Today there are ~10, which Phase 2 maps onto these.
- **Depth:** one card treatment, `.card.white` = a 1px `--line` hairline + `0 2px 10px rgba(35,35,32,.06)`. Wash cards have no edge.
  Sheets dim the page; nothing else casts a shadow.
- **Tap targets:** at least 44 × 44. The primary button is 52 tall, secondary 48.

## Motion
| Token | Value | Use |
|---|---|---|
| `--ease-out` | cubic-bezier(0.23, 1, 0.32, 1) | everything that enters or settles |
| `--ease-in-out` | cubic-bezier(0.77, 0, 0.175, 1) | things moving across the screen |
| `--dur-fast` | 120 ms | press, fade, reduced motion |
| `--dur` | 220 ms | settle, toast in |
| `--dur-slow` | 320 ms | sheets |

**"Settle into place" (a new log entry, a new row, a saved item):** the PM's proposal, kept, with one tune:
- The new row: `opacity 0 → 1`, `translateY(6px → 0)`, `scale(.98 → 1)`, **220 ms**, `--ease-out`. No overshoot (no `--back`
  curve: "soft, not bouncy").
- The rows below it slide down to make room over the **same 220 ms** with the same curve (FLIP: measure before and after,
  animate the transform), so the list never jumps.
- **Tune:** start the new row's fade **40 ms after** the neighbours begin to move, so it lands into space that's already opening
  (it reads as "settling" rather than "appearing").
- **Reduced motion** (`prefers-reduced-motion: reduce`): no movement, a **120 ms opacity fade** only; neighbours jump.
- Never on first page load (only on items added while you watch).
- Replaces today's `.pop` (500 ms, which feels like a pop) for list items. `.pop` stays only for celebrations.

## Phase 2 (after Josh says go)
1. **`src/styles/tokens.css`:** every token above (colour light + dark, type sizes, space, radius, motion), imported first
   in `main.tsx`. `app.css` keeps only component classes.
2. **Sweep:** every literal colour, font size, spacing and radius in `src/**/*.tsx` inline styles and `app.css` is swapped for a
   token (e.g. `fontSize: 15` → `var(--fs-title)`, `#d4a23a` → `var(--butter-strong)`). Pause only on real judgement calls
   (an off-scale value that is clearly deliberate) and list them in the PR.
3. **Component inventory** (added to this doc), each with its import path and key props: Button (`.btn`
   primary / `.btn2` secondary / text and danger), Input (`.in` + `label.field`), Chip and chip button, Card (white / wash), Sheet
   / dialog (`src/ui/Sheet.tsx`), Toast with Undo (`src/ui/Toast.tsx`), list row (`.item`), table (desktop Health log), tab bar
   and side nav (`src/ui/TabBar.tsx`), Tooltip (`src/ui/Tooltip.tsx`), the settle animation as a small helper (`useSettle()`).
4. **Rules** (go in this doc and in CLAUDE.md):
   - New screens use existing components and tokens only.
   - Anything new goes into the design system first (this doc + tokens), then into screens.
   - **No second button style.** If a button needs to look different, it's a new variant here or it's wrong.
5. **Tabs vs. accordion** (Josh's guidance):
   - **Tabs** for exclusive, equal views the user switches between, up to about 5–7 (e.g. Outfits / Toys / Cushions).
   - **Accordion** for progressive or multiple disclosure, and on narrow screens (e.g. the "Is this an emergency?"
     signs, a visit's older notes).
   - **A table or side-by-side** when comparing values (the desktop Health log, weights over time, vaccine due dates).
