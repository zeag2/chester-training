# After the visit, and fixing log entries

Status: **brief for Josh.** UX reviewer, 2026-11-14, from main and the document reader (`src/lib/docparse.ts`).
Based on the papers Josh got from Chester's new vet today, as the PM described them (no photos shared).

## 1. "After the visit": one flow

**Where it starts:** the visit's own page (`#/health/visit/<id>`). On the visit day and after, the top of the page says
**"Got papers from the vet? Snap them"**: one button that opens the camera or the file picker and takes several pages (chart and invoice
together). It also works from Health → Add a document; the reader then offers "Link to: Nov 14 · Maple Street Vet visit?" if
a visit is on that date, or offers to create one.

**Steps:** snap pages → "Reading on your phone…" → **one review screen** → Save. Then a single toast: "Saved 9
things to Nov 14's visit · Undo".

### The review screen

Grouped, every row a checkbox **ticked by default**, each one editable in place (tap the value to change it):

```
Nov 14, 2026 · Maple Street Vet · Dr. Rivera          [change]
────────────────────────────────────────────────────
WEIGHT
 ☑ 6.98 lb                      (was 7.0 lb on Oct 20)
GIVEN TODAY  (linked to this visit)
 ☑ Revolution Plus · flea/parasite · single dose
 ☑ FeLV vaccine · dose 1 of 2
     ☑ Remind me about dose 2 · around Dec 5–12  [pick day]
 ☑ Fecal test (pediatric)
REMINDERS  (next due)
 ☑ Rabies · Aug 19, 2027
 ☑ FVRCP booster · Sep 26, 2027
 ☑ Yearly exam · Nov 14, 2027
PAST VACCINES  (already in the log? shown greyed out)
 ☐ FVRCP · Aug 19, 2026      ✓ already logged
 ☐ FVRCP · Sep 26, 2026      ✓ already logged
 ☑ FeLV/FIV test · Aug 19, 2026
FOR NEXT TIME  (saved as the visit's notes)
 ☑ Occasional sneezing · mild ear wax · soft stools (history)
DETAILS
 ☑ Cost $273.41
 ☑ Microchip 985…   (matches Chester's chip ✓ / "Add to Chester's profile")
 ☑ Body condition 4/9
────────────────────────────────────────────────────
[ Save 12 things ]        Read on your phone. Check it against the paper.
```

Rules:
- **Duplicates are never added twice.** A dose with the same name and date already in the log shows greyed out with "already
  logged" and starts unticked.
- **Multi-dose series:** "1 of 2" (or "#1", "first") → a dose-2 reminder 3–4 weeks out (FeLV / FVRCP kitten series) at
  the midpoint, editable. When dose 2 is logged, the reminder clears.
- **Reminders** become the dose's `nextDue` (medicines/vaccines) or a booked-visit suggestion for the exam ("Book the
  yearly exam? Nov 2027"), not a separate kind.
- **Which cat:** the header shows the cat's face and name. With several cats, a cat picker shows on top,
  defaulting to the cat whose name or chip matches the papers.
- Everything saved carries `visitId`; the visit page then lists Weight, Given, Reminders, Notes, Cost and the two pages.

### What the reader can do today vs. what's new

| Item on Josh's papers | Today (`docparse.ts`) | Reliability | Change needed |
|---|---|---|---|
| Visit date, clinic | yes (`docDate`, `clinic`) | good on printed charts | link to an existing visit on that date |
| Weight 6.98 lb | yes (`weights`) | good | none |
| Microchip | yes (`profile.microchip`) | good (15 digits) | compare with the cat's chip |
| FVRCP / FeLV / Rabies, Revolution | yes (`PRODUCTS`) | good for names; "Revolution **Plus**" maps to Revolution | keep the full product text as the name |
| Past vaccine dates (8/19/26, 9/26/26) | yes (dates on the line) | medium: a line with two dates can pair wrongly | show the date per row, editable |
| Next-due reminders | yes when the line says due/next/booster | medium: a "Reminders" table with three columns may need the header word | treat a "Reminders" heading as "due" for the lines below |
| FeLV/FIV test, fecal test | yes (test → visit entry) | good | save as "Given today" items, not separate visits |
| "1 of 2" dose series | **no** | — | new: a regex for `(\d) of (\d)`, `#\d`, `dose \d` |
| Invoice total $273.41 | **no** | good if the line says Total | new: `total` + an amount |
| Vet name (Dr. …) | **no** | good ("Dr." / "DVM") | new |
| Body condition 4/9 | **no** | good ("BCS" / "body condition") | new, as a note |
| Exam table, history, problems | **no** (free text) | poor: tables and handwriting OCR badly | offer "Add notes" with the OCR text to pick from, not auto-filled |
| Prices per line | no | poor | skip; keep only the total |

**Manual check always:** dates (US m/d vs d/m), dose numbers, anything handwritten, the problems list. The screen says
so once, at the bottom, not on every row.

**New data (JSON in `care.data`, no SQL):** `vet.cost?`, `vet.vetName?`, `vet.bcs?`, `med.series?: { n, of }`,
`doc.visitId` (exists). The dose-2 reminder is just `nextDue` on the dose-1 entry.

## 2. Adding and editing log entries: audit

Where you can add or change an entry today:

| Place | Adds | Edits / deletes | Problem |
|---|---|---|---|
| Home Quick log tiles | Fed/Scooped/Played/check | Undo (5 s), then "Fix today's entries" sheet | fine |
| **+** menu | weight, symptom, food, vet, med, doc, set | — | the form title doesn't say **which cat** |
| Health → Log something | the same six forms | — | same forms as **+**, a second way in |
| Health log row → sheet | — | edit, **Delete** (browser `confirm()`, no undo) | the same sheet as Add with "Edit" in the title; easy to change the wrong entry; delete is permanent for the whole household |
| Visit page | dose, weight, document | Edit visit, Delete visit, Reschedule, Cancel | items added here are linked; the same item added from Health isn't (no visit picker) |
| Document reader review | many at once | — | after Save there's no way to undo the batch; a misread adds wrong entries one by one |
| Kitten timeline row | vet or med with a preset | — | it's a log form in disguise, so tapping a row to "see it" adds an entry |

**What likely caused "I messed things up":**
1. **No "which cat"** in any form header. With Chester and a second cat it's easy to log to the wrong one (the
   switcher is far up the page).
2. **Delete has no undo** and uses the browser's confirm dialog, while Quick log has a friendly Undo. The patterns don't match.
3. **Doses added from Health aren't linked to the visit,** so the visit page looks empty and people add them again → duplicates.
4. **The reader's batch save can't be undone,** and its entries look like hand-typed ones.
5. **Tapping a kitten-timeline row opens a log form,** when people expect to read the row.

### One pattern for every entry

- **One sheet for add and edit**, with the header always **"[cat face] Chester · Weight"** (and the cat chip tappable to switch
  before saving).
- **A visit picker on dose, weight and symptom forms:** "Part of a visit?" with today's/recent visits as chips (default: a
  visit on the same day).
- **Every save and delete ends with the same toast: "Saved / Deleted · Undo"** (5 s), the Quick log pattern. Delete still
  asks once, in-app ("Delete this weight? Undo for a few seconds after"), not with `confirm()`.
- **Batch saves (the reader) get one Undo for the whole batch,** and the entries carry "from document X" so they can
  be found and removed together.
- **Duplicate guard:** saving a dose or weight that matches one on the same day asks "Already logged at 10:30. Add
  another?"
- **Kitten timeline rows open the matching entry (or the visit),** with "Log it" as a separate button when nothing is logged.

## Build steps
1. One toast with Undo for every save/delete; an in-app delete confirm (S–M).
2. Cat chip in every sheet header (S).
3. Visit picker on dose, weight and symptom forms; the duplicate guard (M).
4. Reader additions: dose series, total, vet name, BCS, a "Reminders" heading, linking to the visit (M).
5. The review screen grouped as above, with batch Undo (M).
6. Kitten timeline rows open entries; "Log it" separately (S).
