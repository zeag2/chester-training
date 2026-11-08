# UX review log

Kept by the scheduled "PalDex UX review" task (see docs/HANDOFF.md, section 7). The reviewer reads this file first.
When a review runs, it adds a `last-reviewed: <sha>` line at the top and a dated entry below.

## Notes from Josh for the reviewer (read every run)

- **Logging must be effortless.** If logging is tedious, nobody will do it. Look for every extra tap, every form
  that could be a one-tap button with Undo, every field that could have a sensible default. Suggest (in the PR's
  "Suggestions" list) where a form should become a single tap.
- **Known polish to fix:**
  - Visit screen (`src/screens/Visit.tsx`): a large empty gap between the speech bubble and the cat.
  - White cards (`.card.white`) blend into the white page in light mode (no visible edge).
  - The disabled "Given today" button on Visit still looks active.
- **Leave for the feature sessions (don't change, suggest only):** merging the two friends cards on Home (the
  friends session is doing it), the one-tap logging buttons, meals, litter and the daily health check (on the
  checklist in docs/HANDOFF.md, section 2).
