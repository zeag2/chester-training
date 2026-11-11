last-reviewed: 237f96920d13674d44e8a8001c3aa19ca0f2e462

# UX review log

Kept by the scheduled "PalDex UX review" task (see docs/HANDOFF.md, section 7). The reviewer reads this file first.
When a review runs, it adds a `last-reviewed: <sha>` line at the top and a dated entry below.

## Notes from Josh for the reviewer (read every run)

- **Logging must be effortless.** If logging is tedious, nobody will do it. Look for every extra tap, every form
  that could be a one-tap button with Undo, every field that could have a sensible default. Suggest (in the PR's
  "Suggestions" list) where a form should become a single tap.
- **Known polish to fix:** (none open; the first three were fixed in the 2026-11-09 review)
- **New on Home (2026-11-08):** the Quick log card (`src/ui/DailyTaps.tsx`: Fed, Scooped, Played, the daily check,
  Undo) and one friends card. Review them like any new screen.
- **Leave for the feature sessions (don't change, suggest only):** merging the two friends cards on Home (the
  friends session is doing it), the one-tap logging buttons, meals, litter and the daily health check (on the
  checklist in docs/HANDOFF.md, section 2).

## Reviews (newest first)

### 2026-11-11: 32c5bba..237f969
Checked at iPhone 15 size (light and dark) and 1280 px desktop, with a saved vet and emergency vet, a booked
and two past visits, a dose, a weight and three documents: Health (Your vet card with no vet and with one, Visits,
Book a visit sheet), the visit page, All documents, the Summary for the vet, Home's Quick log with the new floating
Undo toast, the box hideout, and the desktop side menu and side-panel forms.

Fixed:
- Visit page: the top bar and the big heading both showed the visit's reason ("Checkup + rabies" twice). The top
  bar now says "Vet visit".

The rest read well. The floating Undo toast, the Your vet card (Call is one tap from Health) and booking with the
calendar cover earlier suggestions. Earlier friends-card note (2026-11-10): one tile per friend, reviewed, no changes.

### 2026-11-09 (16:17 UTC): 686bdb6..32c5bba
Checked with two cats (Chester and Luna): Quick log with "Luna too" / "All cats", the full-belly pose after Fed,
the Corner's Play row, Play with the laser dot and the feather wand (moves found, first-play toast), and the
weight and medicine forms with smart defaults, in light and dark mode.

Fixed:
- Merged main into this PR. The new Quick log Undo note (with "Luna too") conflicted with this PR's polish. The
  merge keeps main's behaviour and carries the polish over: buttons 44 px (they were 40), and a short label without the time.

No other clear wins: the Play screen, Corner and the forms read well. Disabled Save on the forms now looks disabled.
Suggested: see the PR's "Suggestions (not done)".

### 2026-11-09 (04:13 UTC): 39b124c..686bdb6
Checked with fake friends (an incoming request from Dana, one sent to Sam, a treat from Erin): Home friends card
(request row, Say thanks), Friends (requests, Waiting to accept), Visit (Remove friend), Health (Summary for the vet,
kitten vaccine timeline, weight guide), the vet summary, light and dark.

Fixed:
- Tap targets under 44 px raised to 44: Accept / Not now (Home and Friends), Say thanks, Cancel request, Remove /
  Keep friend (Friends and Visit), Looked off? / Undo in Quick log, and the browser chips on the install steps.
- Vet summary sections and the kitten timeline card drew a second border on top of `.card.white`'s new edge (a double
  ring in dark mode); the extra borders are gone.
- Health: "Summary for the vet" sat between the title and its subtitle; it now comes after the subtitle.

Suggested: see the PR's "Suggestions (not done)".

### 2026-11-09: first run (last 24 h of main, up to 39b124c)
Checked at iPhone 15 size, light and dark, with a fake friend (Erin's Mochi): Home (Quick log, daily check, Undo
note, friends strip), Visit (treat available and given), Health (care treat note), Chester's week, Trophy case,
Friends, Corner, Train.

Fixed:
- Visit: gap between the speech bubble and the cat cut from ~62 px to ~26 px (Known polish).
- `.card.white` gets a hairline edge and a soft shadow, so white cards show on the white page (Known polish).
  Quick log dropped its own near-invisible border to use it.
- Disabled `.btn` looks disabled everywhere (grey, muted text, no press ripple): "Given today" on Visit, and
  Save buttons waiting for valid input (Known polish).
- Quick log Undo note: "Litter scooped · 1:14 AM" wrapped to four lines beside Looked off? / Undo. Now just
  "Scooped" (the tile already shows the time); it fits on one line.
- Daily check: "Something's off" wrapped to two lines; tighter button padding keeps it on one.
- Visit: the "sets this week" chip was white on a white card (invisible edge); now grey like other chips.
- Home bubble copy: "Ready for charge the clicker?" read wrong; now "Next up: Charge the clicker. Ready?".

Suggested (in the PR, not done): see PR "Suggestions (not done)".
