# PalDex design system

The design doc for PalDex. New screens and changes follow it; anything it doesn't cover gets added here first.
Phase 1 named the direction and the tokens. Phase 2 (done) moved the code onto them: tokens, components and rules are below.
Updated 2026-11-26 for the badge art (Josh): the art layer, branch colours, art sizes and their rules. 2026-11-27: the segmented control (`Segmented`, with its slide); the four props ("Props": prop art, shelf icons, the prop stage, `--art-floor`, `--fall`).

## Constraints (Josh)
- **One named aesthetic direction, committed.** Never "modern and clean".
- **No Inter, Roboto or system fonts** as the face (system fonts only as a last-resort fallback in the stack).
- **No purple or indigo gradients.** No centered three-card hero.
- **Hierarchy from type and space,** not borders and boxes everywhere.
- **Real, specific content only:** Chester, Luna, "Fed 1 of 2 · 7:40 by Megan". No lorem ipsum, no "Item 1".
- Obey this doc.

## Direction: **warm-minimal, "kitchen-table notebook"**
A warm, quiet notebook kept by the food bin. Soft paper and ink, a few pastel washes the colour of cat-care
things (butter, mint, peach, sky), one rounded friendly sans, big confident headings, generous space. Colour marks
*kind* (mint = done or healthy, peach = attention, butter = treats and rewards, sky = planning and vet), never
decoration, and never the only signal (always with an icon or words).

**Two layers** (since the badge art, 2026-11-25):
- **The UI layer** (screens, cards, rows, buttons, line icons): paper and ink, flat washes, no outlines, everything
  above. This is most of every screen.
- **The art layer** (the cat, the badges, the Chester-style icons): one illustration family, the "sticker" look.
  Pastel fills with a dark navy outline (`--art-outline` / `--badge-outline` #1f2440, lighter in dark mode), soft
  rounded shapes, a light highlight on top. This is where the app's character lives, and the only place outlines and
  the branch colours appear. Art sits *on* the UI layer (on `--bg`, a white card or a wash) and is never stretched,
  recoloured or redrawn in a screen.
- Keep the art scarce so it stays special: the cat, the trophy case and skill moments (badges), and the nav (Chester
  icons). Everywhere else uses the line icons. A screen never has more than one big piece of art (the cat or a badge
  at 56 px and up); small badges in a row (the trophy shelf) count as one.

What it is not: no gradients, no glass, no drop shadows beyond the one soft card shadow, no outlines around UI
(outlines belong to the art layer only), no neon.

## Type
| Role | Font | Weight | Size / line height | Use |
|---|---|---|---|---|
| Screen title (`h1`) | **Nunito** | 800 | 28 / 1.15, letter-spacing −0.01em | screen titles ("Chester's health") |
| Section head (`h2`) | Nunito | 800 | 17 | section heads ("Visits", "Log something") |
| Big number | Nunito | 800 | 34 / 38 | friend and invite codes, the Recap count, "Yes!" |
| Title | Nunito | 700 | 16 / 22 | card and row titles |
| Body | Nunito | 400 | 16 / 24 | sentences, form values |
| Small | Nunito | 600 | 14 / 20 | sub-lines, chips |
| Label | Nunito | 800 | 12 / 16, uppercase, +0.6px tracking | "YOUR VET", "NEXT"; class `.label` (and `.lhead` for Settings group heads) |
| Numbers | Nunito, `font-variant-numeric: tabular-nums` | 700 | as context | weights, counts, times |

- **One family:** Nunito (Google Fonts, 400/600/700/800, already loaded). It's rounded and friendly, readable at 14 px, and it
  suits the cat. The stack is `Nunito, "Avenir Next", sans-serif` (drop `system-ui`).
- Hierarchy comes from **size and weight jumps** (28 → 17 → 16 → 14 → 12, with 34 for big numbers), not from colour or boxes.
  These are the app's real sizes (Josh, 2026-11-23: the doc follows the app, the app doesn't move).
- **Allowed in-between sizes** (Josh, 2026-11-23: they stay): 13 (`.s` sub-lines, field labels), 15 (`.btn2`, inline
  sub-lines), 17 and 18 (card titles). Use them only where the same role already uses them; a new role takes a scale size.

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
| `--paw-coral` | #c2563f | #c96f5a | the coral paw on peach cards (Train, Recap); dark is toned down, quieter than `--rose` |

Rules: a wash colour (`--mint`, `--peach`, `--butter`, `--sky`) is a **card background** with its `-ink` text; never two washes
next to each other in one card. `--rose` is for destructive text and the emergency call only.

### Branch colours (skill branches; the badge art)
A second colour family with one job: **which skill branch** something belongs to. Same values in light and dark (the
art carries its own outline, so it reads on both).

| Branch | Shape | `--branch-*` (fill) | `-light` (highlight) | `-ink` (accent) |
|---|---|---|---|---|
| Foundation | gold coin | #efc44a | #fbe7a6 | #c9962a |
| Care | rose shield | #ef8f9a | #fcd8dd | #d2493f |
| Manners | teal hexagon | #6cc3b5 | #d2efe9 | #2a7a6f |
| Adventure | sky diamond | #7aa5dc | #d9e6f8 | #3f6fb0 |
| Tricks | orange rosette | #f3a65e | #fde2c4 | #d9772c |

- **Where they may appear:** in the badge art itself, and as a small branch marker in UI next to the branch name (the
  dot by a shelf head in the trophy case; the same dot may mark a branch in the skill tree, Library and a skill page).
  Always with the branch name or shape beside it, never colour alone.
- **Where they may not:** as card backgrounds, text colour, buttons or progress bars (those stay on the kind washes and
  `--ink`). Branch colours never stand in for a kind (a Care badge is rose, but "attention" is still `--peach`).
- The same shape always means the same branch: a coin is Foundation everywhere, so don't reuse the five shapes for
  anything else (chips, avatars, empty states).
- New branch → pick its shape and colours in the art first (the art artifact's `generate.mjs`), then add the tokens
  here and in `tokens.css`.

## Space, shape, depth
- **Space scale** (px): 4, 8, 12, 16, 20, 24, 32. The screen gutter is 20 on a phone. Sections are 24 apart, cards 12, inside a card 8–12.
- **Allowed in-between gaps** (Josh, 2026-11-23: they stay): 6, 10, 14, 18, 22 (e.g. `marginTop: 22` above section
  heads, `10` between rows, 6 under a field label). Same rule: only where that spot already uses them.
- **Radius:** 8 (small chips inside cards), 14 (rows, inputs, small tiles), 22 (cards), 26 (sheets), 999 (pills: buttons, chips).
  That's 5 values. Inputs (`.in`) moved from 16 to `--r-row` 14 on 2026-11-23. The remaining off-scale radii are listed under "Not yet on the scale".
- **Depth:** one card treatment, `.card.white` = a 1px `--line` hairline + `0 2px 10px rgba(35,35,32,.06)`. Wash cards have no edge.
  Sheets dim the page; nothing else casts a shadow.
- **Tap targets:** at least 44 × 44. The primary button is 52 tall, secondary 48.
- **Art sizes** (the art layer has its own steps, so badges and icons don't drift): Chester icons 24 (tab bar, rail,
  side nav), 48 (the phone's gold +); badges 64 (`--badge-tile`, the trophy shelf), 96 (one badge on its own: a skill
  page, a "new badge" moment). Badges are drawn for 56–96, so never smaller than 56 (use the line `badge` icon in a
  row instead). Line icons 16 (inside a link), 18 (row chevron), 22 (icon tiles), 24.

## Motion
| Token | Value | Use |
|---|---|---|
| `--ease-out` | cubic-bezier(0.23, 1, 0.32, 1) | everything that enters or settles |
| `--ease-in-out` | cubic-bezier(0.77, 0, 0.175, 1) | things moving across the screen |
| `--dur-fast` | 120 ms | press, fade, reduced motion |
| `--dur` | 220 ms | settle, toast in |
| `--dur-slow` | 320 ms | sheets |
| `--fall` | cubic-bezier(.33, 0, .66, .33) | art only: a fall under gravity (the prop scenes' jumps and hops) |

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

**Accordion open / close** (2026-11-26, the `Accordion` component): the body's height animates open and closed over
**220 ms** (`--dur`, `--ease-out`; CSS `grid-template-rows: 0fr → 1fr`, so no measuring), the chevron turns from
pointing right (closed) to down (open) over the same time. Closed content is `visibility: hidden` once closed, so it
is out of the tab order and VoiceOver. **Reduced motion:** no height animation; the body appears or goes at once and
its content fades in over `--dur-fast`; the chevron flips without turning.

**Segmented control** (2026-11-27, the `Segmented` component): the white thumb slides from the old segment to the
new one over **220 ms** (`--dur`, `--ease-out`; a `transform: translateX` on `.segthumb`, so no layout work), and the
labels' colour changes over the same time. The view underneath swaps at once (no cross-fade). **Reduced motion:** the
thumb jumps (no slide).

**Icon motion** (2026-11-26, Josh: "make it feel more human"). Small, warm moves on an icon, played **only by the
person's own action** (a tap, a press, a hover), **never on first load, never looping**, each at most `--dur`. They
move the icon's `<svg>` as a whole (transform only): the art itself is never redrawn, filtered or recoloured. HIG
`motion.md` › Providing feedback: brief and precise, and avoid motion on interactions that happen very often, so the
moves are a few pixels or degrees.

| Class (on the icon's `svg`) | Move | Where | Trigger |
|---|---|---|---|
| `.imo-turn` | turns `--imo-turn` (30°) and back | the Settings gear (Home, side nav) | tap (`playIconMotion`), and on hover with a mouse |
| `.imo-bounce` | lifts `--imo-lift` (3 px), grows 6 %, settles | Home, Health and Friends tab icons | selecting a tab that wasn't current |
| `.imo-nod` | dips its head: tilts `--imo-nod` (8°) forward and back | the cat (paw) tab, the brand paw | selecting the tab / tapping the brand |
| `.imo-pop` | soft pop: 0.9 → 1.05 → 1 | the + (gold Chester plus, the desktop Log button's +) | press |
| `.imo-nudge` | moves `--imo-nudge` (3 px) toward where it leads | a row's chevron (`.chev`) | while the row is pressed (CSS `:active`) |

- JS-played moves use `playIconMotion(el, kind)` / `iconPress(kind)` from `src/ui/iconMotion.ts`: it adds the class,
  and removes it on `animationend`, so the same tap can play it again. Hover and press moves are CSS transitions.
- Tokens: `--imo-turn 30deg`, `--imo-lift -3px`, `--imo-nod 8deg`, `--imo-nudge 3px`; durations are `--dur` (and
  `--dur-fast` for the chevron), curve `--ease-out`.
- **Reduced motion:** no movement at all; a played move becomes a `--dur-fast` dip in opacity (1 → .6 → 1), and the
  hover / press moves do nothing.
- The old `.tab.on svg` "ktabin" scale (450 ms, played on every load) is gone: a tab now moves only when you pick it.

## Tokens in code (`src/styles/tokens.css`)
Every token above lives in `src/styles/tokens.css`, which `app.css` imports first; `app.css` and `chester.css` hold only
component classes. Use them as `var(--name)` in CSS and in inline styles (`style={{ fontSize: 'var(--fs-small)' }}`).

| Group | Tokens |
|---|---|
| Colour (light + dark) | `--bg --surface --ink --ink-2 --muted --muted-2 --line --grey --on-ink --faint`, `--mint --teal --teal-ink`, `--peach --rose --peach-ink`, `--butter --butter-ink`, `--sky`, `--tabs --yes-active`; hover washes `--hov --hov-ink` (mouse only) |
| Colour (light + dark, one job) | `--paw-coral` (the coral paw on peach cards) |
| Colour (same in both themes) | `--butter-strong` #d4a23a (the gold treat paw), `--paper` #fff (documents and photos sit on white) |
| Type | `--font`; `--fs-h1` 28 (`--lh-h1` 1.15), `--fs-h2` 17, `--fs-display` 34 (big numbers), `--fs-title` 16, `--fs-body` 16, `--fs-small` 14, `--fs-label` 12, each with its `--lh-*` |
| Space | `--sp-1` 4, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 20, `--sp-6` 24, `--sp-8` 32 |
| Radius | `--r-chip` 8, `--r-row` 14, `--r-card` 22, `--r-sheet` 26, `--r-pill` 999 |
| Depth | `--shadow-card` (the one card shadow), `--shadow-float` (dialogs, the drop note) |
| Motion | `--ease-out --ease-in-out` (`--sine`, and `--back` for celebrations only), `--dur-fast` 120, `--dur` 220, `--dur-slow` 320, `--settle-delay` 40; `--shine-ms` 520 and `--shine-flash-ms` 240 (the badge shine); the segmented control's thumb uses `--dur` + `--ease-out` (`.segthumb`); icon motion `--imo-turn` 30deg, `--imo-lift` −3px, `--imo-nod` 8deg, `--imo-nudge` 3px (classes `.imo-*`, see "Icon motion") |
| Prop scenes (art layer) | `--art-floor` (the floor line a prop scene draws: #e3e0d5 light, #55564e dark; `.propstage` maps it to the scenes' `--floor`); `--fall` cubic-bezier(.33,0,.66,.33) (gravity: speeding up on the way down, for jumps and hops in the scenes) |
| Badge and icon art (same in both themes) | `--branch-<foundation\|care\|manners\|adventure\|tricks>` with `-light` and `-ink`; `--icon-sky --icon-grey` (Chester icon fills); `--art-outline` (Chester icon outline, light and dark); `--badge-outline`; `--badge-tile` 64; `--icon-idle` (a tab icon that isn't current) |

**Not yet on the scale (left as literals on purpose, so nothing moved).** The sweep only swapped values that equal a
token exactly. These are today's real values, off the scale; moving them is a visible change, so each needs its own
go-ahead and a screenshot pass:
- Type: 11 for tiny count badges (the little number pills, not the badge art), 22–32 for big numbers. (13, 15, 17, 18 are now allowed exceptions, see Type.)
- Space: the 110 px tab-bar clearance. (6, 10, 14, 18, 22 are now allowed exceptions, see Space.)
- Radius: 16 (`.hit`, `.bkvet`, `.bkcall`), 18 (`.lgroup`, the toast), 9, 10, 12, 20, 28, 32.
- Motion: press feedback is 160 ms (`.btn`, `.item`), between `--dur-fast` and `--dur`.
- Colour: the cat's art and the toys (`src/chester/art.ts`, Corner, Hideout, Play, Chase, Yarn ball, the stars and
  hearts in `chester.css`) keep their own palette: it's illustration, not UI. Camera and photo overlays keep fixed white
  and black (they sit on video, whatever the theme). The coral paw on peach cards now uses `--paw-coral` (2026-11-23).
- The font stack keeps `system-ui` before `sans-serif`: Nunito has no arrow (→), and dropping it changed that glyph.

## Components (use these; don't make new ones in a screen)
| Component | Where | Key props / classes |
|---|---|---|
| **Button**, primary | `.btn` (`src/styles/app.css`) | `<button className="btn">`; 52 tall, ink pill, full width; `disabled` greys it |
| Button, secondary | `.btn2` | 48 tall, grey pill, inline; add `style={{ width: '100%' }}` to fill |
| Button, text / danger | `.btn2.plain`: transparent, 44 tall, 14 px bold, a little side padding (danger: `color: var(--rose)`). For "This week", "All documents", "Quick logs, last 7 days", Cancel in a form; a link onward ends with `<Icon name="chevron" size={16} />` | e.g. "Remove this vet" in `src/ui/VetCards.tsx` |
| Button, destructive confirm | `.btn.danger`: the primary button in `--rose` | only as the last step of something that can't be undone, inside its sheet ("Remove from household", "Delete my account"); the row that opens it is a danger row |
| Icon button | `.iconbtn` | 44 × 44, needs `aria-label` (it becomes the desktop tooltip) |
| Chip / chip button | `.chip` (label) · `.chipbtn` (+ `.on` when picked) · `.seg` (segmented: buttons inside, `.on`) | chipbtn 44 tall |
| **Segmented control** (switch between views) | `Segmented` from `src/ui/Segmented.tsx`; CSS `.seg.slide` + `.segthumb` in `app.css` | `label` (its accessible name), `options` (`[value, label][]`, 2–5 short words), `value`, `onChange`. For **exclusive, equal views of one screen** (HIG `segmented-controls.md`): Health "Overview · Log · Documents", Skills "Tree · List". Full width under the screen title, `role="tablist"` with one `role="tab"` per segment (`aria-selected`, Left/Right arrows move between them); the view under it is its `role="tabpanel"`. A white thumb (`--surface`) marks the chosen segment and **slides** to the new one (see Motion). The screen remembers the chosen view for the session (`sessionStorage`), and its address says the view (`#/health/log`, `#/skills/list`), so links land on it. **One primary (`.btn`) button per view at most**; the rest are `.btn2`. Picking one value in a form (Boy / Girl, Merge / Replace, the daily check's choices) stays the plain `.seg` with `aria-pressed`, no slide |
| **Input** | `<label className="field">` + `<input className="in">` | 52 tall, grey fill; `select` uses `.in` too. A `textarea.in` (several lines, e.g. the Contact us message) sizes by `rows`, with `--sp-3` padding top and bottom and `--lh-body` lines, and can be dragged taller. Optional fields say so in the label: "Your name (optional)" |
| Switch | `.switch` (`role="switch"`, `aria-checked`) | Settings |
| **Card** | `.card` + `white` (hairline + `--shadow-card`) or a wash (`mint` `peach` `butter` `sky` `grey`) | `a.card` / `button.card` for tappable cards. No extra outline on top (the Health vet card's 2 px border went 2026-11-25) |
| **Card link** (a card that is the button, plus one chip) | `.card.cardlink` > `a.row` + `button.chipbtn` (`src/styles/app.css`) | The `<a>` stretches over the whole card (`::after`), so the card is the tap target and presses like `a.card`; the one `.chipbtn` sits above it, lined up under the title. A `.chip` inside the link says the action ("Start"). The Home Training card: tap to start the next skill, "Change skill" chip to pick another |
| Icon tile | `.ico` (+ a wash class) with `<Icon name>` from `src/ui/icons.tsx` (line set; `ChesterIcon` only in the nav, see "Badges, shine and icons") | `Icon({ name, size = 22 })`, `Paw({ color, size })` (`flex: none`, so it never squeezes in a `.row`) |
| **Screen header** | `ScreenHeader` from `src/ui/ScreenHeader.tsx` (`.top` + `.toptitle`) | `title`, `onBack`, `backLabel?` ("Back"), `back?` (`'close'` for an X), `trailing?` (an `.iconbtn`, a `.btn2` (44 tall here) or a `.chip`), `heading?` (default true: the title is the page's `<h1>`). Every screen that isn't a tab opens with it: back, the name at 17 (`--fs-h2`, one line, ellipsis), the action on the right. **The 28 px `<h1>` is only for the top-level tabs** (Home, Health, Chester, Friends), which have no back row. One exception: a page about one thing (a visit, the cat on For the vet, a skill, the session recap, a setup step's question) puts that thing as its h1 under the header and passes `heading={false}`, so there's one h1 |
| **Sheet / dialog** | `Sheet` from `src/ui/Sheet.tsx` | `label` (its accessible name), `onClose`, `children`; bottom sheet on phones, dialog or side sheet on desktop. Its first row is the sheet header: the title in bold 18 (`.sp`) and a Close `.iconbtn` with the close icon on the right |
| **Toast with Undo** | `showToast` / `hideToast` from `src/ui/Toast.tsx` (`<ToastHost />` is in App) | `{ msg, action?: { label, run }, ms? }` |
| **List row** | `.item` (rows with a hairline), `.lgroup` + `.lrow` (grouped rows in a grey box, Settings) | `.ico` left, `.sp` middle, value right; a row that opens something ends with `<span className="chev"><Icon name="chevron" size={18} /></span>` (never a typed "›") |
| **Locked row** (a skill not unlocked yet) | the tree's `Node` and the Library rows | Full contrast like any row; the lock icon in the icon tile says it, with a `.visually-hidden` "Locked" for VoiceOver. No "Locked" pill, no dashed edge, no greyed text |
| Document row | `DocRow` from `src/ui/DocRow.tsx` | `doc`, `visit?`, `onMore`, `onSelect?`, `selected?` |
| **Table** | `.logtable` (desktop Health log, `HealthLogTable` in `src/screens/Care.tsx`) | `log`, `quick`, `who`, `onOpen`, `onQuickLogs` |
| **Tab bar / side nav** | `TabBar` from `src/ui/TabBar.tsx` | `active`, `onPlus`, `dot?`, `catLabel?`; the same bar becomes the side nav from 760 px |
| **Accordion** (progressive disclosure, see Rules) | `Accordion` from `src/ui/Accordion.tsx`; CSS `.acc` in `app.css` | `title` (what it discloses, e.g. "Water and appetite (optional)"), `children`, `defaultOpen?`; or controlled with `open` + `onToggle`. The header is a 44 px tall button (`aria-expanded`, `aria-controls`) with the title at `--fs-small` bold and a `chevron` that points right when closed, down when open (HIG `disclosure-controls.md`). Opens and closes in `--dur` (see Motion). No card of its own: it sits inside a card or panel. First use: the daily check's Water and Appetite on Home; also Health → Log's "Older than a week (n)" |
| **Notice** (one dismissible note on Home) | `HomeNotice` from `src/ui/HomeNotice.tsx` | `.card sky`, a bold title, a `.s` line, one action (`.btn` or `.btn2` on `--surface`) and a Close `.iconbtn`. Shows one note at a time, most important first: "PalDex has a new home", then "Your Home Screen icon still shows the old cats". Closing remembers it on this phone |
| **+ log list** | `QuickLog` from `src/screens/QuickLog.tsx` | the one full list of everything you can log, as grouped rows (`.lgroup` + `.lrow`, a label above each group): Health, Food, Training, Documents. One name per kind, used everywhere: Weight, Symptom, Medicine or vaccine, Vet visit, Grooming, Food or treat, Training set, Vet document (`LOG_NAMES` in `src/engine/care.ts`) |
| Pet switcher | `PetSwitcher` from `src/ui/PetSwitcher.tsx` | `style?`, `inNav?` |
| **Tooltip** | `TooltipHost` from `src/ui/Tooltip.tsx` (mounted once) | automatic on `.iconbtn[aria-label]` and `[data-tip]`, hover devices only |
| Progress bar | `.bar` > `<i style={{ width }}>` | |
| Inline question panel | `PANEL` + `Choice` in `src/ui/DailyTaps.tsx` (What's off?, Playtime, Daily check) | a `--sky` box inside the Quick log card: bold title, `.s` line, then `.seg` one-of rows (`Choice`: label above, tap the picked one again to clear) or `.chipbtn` chips, then `.btn2` + `.btn` side by side |
| **Settle** (a new row) | `useSettle(keys)` from `src/ui/settle.ts`; CSS `.settle` in `tokens.css` | ref on the list, `data-settle-key={id}` on each row. Used by the Health log (phone list and desktop table) |
| **Badge** | `BadgeTile` in `src/screens/Trophies.tsx` (`.badgetile`), `BadgeShine` from `src/ui/BadgeShine.tsx` | see "Badges, shine and icons" |
| **Prop stage** (a prop's game) | `PropPlay` from `src/screens/PropPlay.tsx`; CSS `.propstage` + `.propscene` in `app.css` | `prop` (`'donut' \| 'post' \| 'perch' \| 'kicker'`); see "Props" |
| Layout | `useLayout()` from `src/ui/layout.ts` | `phone`, `tablet` or `desktop` (760 / 1100 px) |
| Visually hidden | `.visually-hidden` | text for VoiceOver only ("Locked" beside a lock icon) |
| **Ask card** (a yes/not-now question at the right moment) | `PushAsk` from `src/ui/PushAsk.tsx`: `.card butter`, a Title line, a `.s` sub-line, then "Turn on" (`.btn2` on `--surface`) and "Not now" (`.btn2` transparent) | `title`, `sub`; inline where the moment is (after a friend request), or `askForPush(…)` → `<PushAskHost />` (mounted once in App) shows it in a `Sheet` after a sheet has closed (after saving a repeating medicine). Same pattern as `AccountNudge`. |
| Settings group with switches | `Group` + `Row` + `Switch` in `src/screens/Settings.tsx`; a value picker in a row is a `select.in` | Settings → Notifications: this phone, then one switch per kind, the medicine hour (`select`), quiet hours as text |

## Badges, shine and icons (approved by Josh 2026-11-25; art from artifact 6e9huJ9Z23diCgKwxCHzds)
- **Badges** (`src/assets/badges`, viewBox 100, drawn for 56–96 px; the trophy case uses `--badge-tile` 64). One shape
  and colour per skill branch: **Foundation gold coin, Care rose shield, Manners teal hexagon, Adventure sky diamond,
  Tricks orange rosette** (tokens `--branch-*`; the branch heads in the trophy case carry a dot in that colour, next to
  the name). Three states, from `badgeArtKey()` in `src/engine/badges.ts`: `earned/<skill id>` (full colour),
  `locked/<skill id>` (faded grey with a small lock; not earned yet), `hidden/<branch>` (the branch shape dashed with a
  "?"; a hidden skill not unlocked yet, shown without its name, not tappable). The SVG files are illustration and keep
  their own colours, like the cat. URLs: `badgeArtUrl(key)` from `src/ui/badgeArt.ts`. The art's other styles (medal,
  sticker, "alts") were not chosen.
- **Tap shine** (`BadgeShine` from `src/ui/BadgeShine.tsx`, CSS `.badgeshine` in `app.css`): `src`, `size?`,
  `shine` (earned only), `pulse` (bump to play). A white glint sweeps across the badge, clipped to its shape (the file is
  its own mask), a small pop and tilt, two sparkles, all within `--shine-ms` (520 ms, `SHINE_MS`), plus a short buzz.
  An earned badge waits `SHINE_MS` before opening its skill page so the shine is seen; locked badges open at once and
  never shine; hidden ones don't open (`tapDelay()`). **Reduced motion:** no movement, a `--shine-flash-ms` (240 ms)
  brighten only, and the wait is 240 ms.
- **Icons, two sets** (24 px grid, `src/ui/iconArt.ts`, generated from the art):
  - **Chester-style** (`ChesterIcon({ name, size = 24 })`, class `.cicon`): pastel fill (tokens) + `--art-outline`.
    Only for the tab bar / rail / side nav (Home, Health, +, the cat, Friends, the brand paw, Settings) and the way into
    Settings (Home's gear). Full colour on the current tab, `--icon-idle` on the others. The phone + is the gold
    Chester plus at 48 px (`.plus.cplus`), not the ink circle; the desktop "Log" button keeps `.btn` with a line +.
  - **Line** (`Icon({ name })`, currentColor, stroke 1.9): everything small and inline. The approved line set now
    draws `Icon`; old names are aliases (`heart`→health, `user`→friends, `gear`→settings, `cal`→calendar,
    `click`→clicker). `plus` and `check` keep the plain glyphs (they sit inside round buttons); the circled ones are
    `plus-circle` and `check-circle`. Names the set doesn't have (book, phone, pin, yarn, …) keep their old paths.
    `chevron` (added 2026-11-25, the mirror of `back`) ends every row or link that opens something; no typed "›".
    Icon tiles (`.ico`) and icon buttons draw at stroke 1.9, like the set.
  - **Tab bar labels** (UX review 2026-11-25, item 2): 12 px (`--fs-label`), `--muted` when not current (5.4:1 light,
    7.5:1 dark; it was `--muted-2` at 11 px, 3.47:1), `--ink` on the current tab.

## Props (approved by Josh 2026-11-27; art from artifact STmR6cBuuEYyFGrYTkXtVi, `paldex-art/props/`)
Four corner items with a game of five moves each: **Sprinkle donut** (a cushion, 30 treats), **Sisal tower** (toy, 32),
**Sunny window** (toy, 48), **Catnip pickle** (toy, 16). They are **art layer**, like the cat: pastel fills, the
#1f2440 outline, flat shade shapes; no colour depends on his coat. Use them as drawn (no recolour, filter or redraw in a
screen); new prop art is made in the art kit first and added here.
- **Prop art** (`src/chester/props.ts`): `donut()`, `post()`, `perch()`, `pickle()` (plus `bird`, `butterfly`, `leaf`,
  `heart`, `spark`), drawn in Chester's own pose space (floor y = 190, he stands round x = 100), so a scene stacks prop
  back layer, Chester, prop front layer. Each takes an id for its clip paths: pass a unique one per drawing on a page.
- **Shelf icons** (`ICONS` in `props.ts`, 48 px viewBox, shown at 40 like the other toys) in the Corner's shelf and Play
  row. The donut on Home and in the corner is `CushionArt id="donut"` (its own art, fitted to the cushions' 220 × 76 box).
- **Scenes** (`src/chester/propScenes.ts` + `src/chester/props.css`): 20 scenes `.sc-<prop>-<move>`, each with its own
  viewBox (6:5; Top of the tower is zoomed out to fit the jump), plus a resting scene per prop. `{{CAT|variant|anim}}`
  slots are filled with his own `chesterSVG()` (coat, eyes, outfit). Two poses came with them: `scratch` (stood up on
  the post) and the sit pose's `legs: 'flex' | 'swat'` (front legs split at the elbow). See HANDOFF §3a.
- **The prop stage** (`.propstage` in `app.css`, `PropPlay` in `src/screens/PropPlay.tsx`, inside `PlayShell`): the
  scene fills it at 6:5; `--sky` above his floor line and `--butter` below, like the toy stages (`--floor-at` per scene);
  `--r-card` corners; focusable (Enter or Space is a tap), `role="application"` with the gestures in its label, and the
  same gestures as a line under it.
- **Motion:** each move plays a whole number of its loops (`PROP_MOVES[].ms` in `src/engine/props.ts`), then he rests.
  Curves are the tokens (`--sine`, `--ease-out`, `--ease-in-out`, `--fall`). **Reduced motion:** the moves play as the
  cat's own anims do (they're what you asked for), but no more than one idle move plays by itself, and the tower doesn't
  shake while he scratches.

## Rules
- **New screens use existing components and tokens only.** No literal colours, sizes, spacing or radii in new code.
- **Anything new goes into the design system first** (this doc + `tokens.css` + the component list), then into screens.
- **No second button style.** If a button needs to look different, it's a new variant here or it's wrong.
- **Tabs vs. accordion:**
  - **Tabs** for exclusive, equal views the user switches between, up to about 5–7 (e.g. Outfits / Toys / Cushions).
    Inside one screen these are the `Segmented` control (Health, Skills); the tab bar is only for the app's top level.
  - **Accordion** for progressive or multiple disclosure, and on narrow screens (e.g. the "Is this an emergency?"
    signs, a visit's older notes).
  - **A table or side-by-side** when comparing values (the desktop Health log, weights over time, vaccine due dates).
- New list rows that appear while you watch use `useSettle`; `.pop` is for celebrations only.
- **Art layer** (badges, Chester icons, the cat): use the files as drawn; no CSS filters, recolours or outlines added in
  a screen (the only exceptions: `--icon-idle` on a tab that isn't current, and the shine). Branch colours only as the
  "Branch colours" section allows. New art (a new badge, icon or branch) is made in the art artifact first and added
  to this doc before any screen uses it.
- **Earned vs. not:** only an earned badge is full colour and shines. Locked is grey with a lock, hidden is the dashed
  "?" shape; neither shines, and neither is faded text in UI (rows stay full contrast with a lock icon).

## Phase 2 (done 2026-11-22, `claude/design-system-2`)
What was planned, for the record:
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
   - **Two panes** at 1100 px and up: `.healthcols` with two `.healthcol` children (`src/styles/app.css`), used by
     Health and the Visit page. Phones and tablets keep one column; render the panes only when `useLayout()` is `desktop`.
