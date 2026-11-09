# Vet redesign: "Your vet", visits and documents

Status: **proposal for Josh to approve.** No code yet; the feature session builds it once approved.
Written by the UX reviewer, 2026-11-09, from the real screens at iPhone 15 size (light and dark), seeded with
4 vet visits, 3 vaccine/flea doses, 5 weigh-ins, a symptom, grooming and 5 documents.

Josh's brief: *"Vet docs needs a rework. It was a bit of a struggle finding the most recent checkup, docs etc. Think
about workflow. If you're in a panic trying to schedule a visit, what do you need? Can I add the visit in my app and it
will add to my calendar? Who was my vet? What's their information?"*

---

## 1. Audit of today's screens

Health is one long page, about **5 phone screens** tall with the seed data (3,200 px at 393 px wide). Top to bottom:
title, Summary for the vet, When to call the vet now, Coming up, Kitten vaccines and checkups, Log something, Weight,
Food and treats, Documents (adder, then every document), Health log (every entry of every kind, newest first).

### Taps and scrolls for each job today

| Job | Today | Taps | Problem |
|---|---|---|---|
| **Call the vet** | Not possible in the app. Leave PalDex and find the number in Contacts or Google. | n/a | No vet phone, address or hours stored anywhere. The only trace is a free-text "Clinic" on each visit. |
| **Call an emergency vet** | "When to call the vet now" lists the warning signs and says "call your vet or an emergency vet", but has no number. | n/a | The panic card has no action. |
| **Find the most recent checkup** | Health, then scroll about **4 screens** to the Health log, then pick it out of 17 mixed rows (weights, meds, grooming and visits look alike). Or Health → Summary for the vet → scroll to "Recent vet visits". | 1 tap + 4 screens, or 2 taps + 2 screens | Visits are mixed in with everything else. On the summary, visits can't be tapped, notes aren't shown, and the visit's documents are never shown. |
| **Find a document** | Health, scroll about **2.5 screens** past the adder's paragraph, tap the document, then **Open document** in the sheet. | 3 taps + 2.5 screens | One flat list with no search and no grouping. The adder's long paragraph and big button sit above the list every time. A document is never shown next to the visit it came from, although the data already links them (`vet.doc`). |
| **Book a visit and add it to the calendar** | Health → Vet visit → type a reason (the clinic is pre-filled) → change the date to the future (3–4 taps in the date picker) → an optional Time field appears → **iPhone / Apple** or **Google** → back in PalDex, tap **Save**. | about 8 taps + typing | Calendar and Save are two separate actions, so it's easy to do one and forget the other. The sheet is titled for logging a past visit ("Why you went"). The form shows the calendar options only after a future date is picked, so nobody knows they exist. |
| **See upcoming visits** | A booked visit isn't in "Coming up". It sits at the top of the Health log looking like a past visit. | n/a | **Bug:** the yearly checkup reminder is counted from the newest visit, *including a future one*, so booking a visit pushes the reminder a year past that date. |
| **Show the vet the history** | Health → Summary for the vet. | 2 taps | Good start. It has no documents, no vet/clinic header, visits can't be tapped, and the medicine rows wrap badly ("Revolution (Flea treatment)" over three lines). |

### Heuristic findings (design-ux)

| Heuristic | Finding (located) | Severity | Fix |
|---|---|---|---|
| Match the real world | People think "my vet" and "the visit", but the app has a free-text "Clinic" field and a log of entries. | major | A "Your vet" card and a Visits list. |
| Recognition over recall | The vet's phone and address must be remembered or looked up outside the app. | **blocker** for the panic case | Store the vet's details once, with Call / Directions buttons. |
| Visibility of status | There's no "next visit" anywhere. Booked visits look like past ones. | major | A "Next visit" line at the top, and visits marked Booked vs Done. |
| Aesthetic & minimalist | Health mixes daily care, food, documents and the vet on one 5-screen page. The panic content (the red flags) is a collapsed card. | major | Put the vet things in one section near the top, and move the rest below. |
| Error prevention | Calendar and Save are separate, and a future visit corrupts the yearly reminder. | major | One "Book" action that saves *and* offers the calendar, and only past visits count for reminders. |
| Flexibility & efficiency | There's no search. Documents aren't grouped. The adder's explanation shows every time. | minor | Search, grouping, and a short adder once documents exist. |
| Consistency | Visits on the summary can't be tapped, but the same visits in the Health log can. | minor | Visits open the same visit page everywhere. |

---

## 2. The jobs, ranked

1. **Panic: get help now.** Call my vet. If they're closed or it's night, call the nearest emergency vet. Get
   directions. See the "is this an emergency?" signs. *Target: 1 tap from Health to a call.*
2. **Book the next visit.** Add it in PalDex and put it on my phone's calendar in the same step, with the clinic's
   address and phone already filled in. *Target: Health → Book a visit → pick date and time → Save & add to calendar
   (4 taps, no typing).*
3. **Show the vet the history.** Last visit, vaccines and when they're next due, weights, recent symptoms and
   documents, on one screen that makes sense to someone else. *Target: 1–2 taps.*
4. **Find a specific document fast.** "The rabies certificate", "the neuter discharge notes". *Target: Health →
   Documents (or search) → the document, within 3 taps.*
5. **Know what happened last time.** The most recent checkup: date, reason, notes and its paperwork. *Target: visible
   on Health without scrolling; 1 tap to its details.*
6. **Log what happened** after a visit (notes, weight, doses, documents), ideally from the booked visit, so nothing
   is retyped.

---

## 3. Proposed redesign

### 3.1 Information architecture

Health becomes **vet first, then everyday care**:

```
Health
├─ Your vet  (card: clinic, Call, Directions, emergency vet)       ← panic path, top of the page
├─ Visits    (Next visit · Last visit · See all)                    ← booking and history
│    └─ Visit page (date, reason, notes, doses given, weight, documents, Add to calendar)
├─ Coming up (doses due, grooming, the yearly checkup)
├─ Documents (newest 3 + "All documents": search, grouped by type, linked to visits)
├─ Summary for the vet  (stays; gains the vet header and documents)
└─ Everyday care (Log something, Weight, Food and treats, Kitten timeline, Health log)
```

The "When to call the vet now" signs move **inside the Your vet card**, behind an "Is this an emergency?" link,
so the signs and the phone numbers are in the same place.

### 3.2 Wireframes (phone, 393 px)

**Health, top of the page (no scrolling needed)**

```
┌───────────────────────────────────────┐
│ Chester's health                      │
│ ( Luna ) ( Chester )                  │
│                                       │
│ ┌ YOUR VET ─────────────────────────┐ │
│ │ Maple Street Vet                  │ │
│ │ Dr. Patel · Open until 6 PM       │ │
│ │ [ 📞 Call ]   [ ➤ Directions ]    │ │
│ │ Emergency: CityPets 24h  [ Call ] │ │
│ │ Is this an emergency? ›           │ │
│ └───────────────────────────────────┘ │
│                                       │
│ ┌ VISITS ───────────────────────────┐ │
│ │ Next   Tue Nov 24, 10:30 · Booster│ │
│ │        [ Add to calendar ]        │ │
│ │ Last   Oct 20 · Checkup + rabies ›│ │
│ │        2 documents                │ │
│ │ [ + Book a visit ]   See all (4) ›│ │
│ └───────────────────────────────────┘ │
│                                       │
│ [ Summary for the vet ]               │
└───────────────────────────────────────┘
```

- When no vet is saved, the card reads: **"Add your vet: one tap to call them when you need to"**, with an **Add your vet**
  button. Never a nag or a red badge.
- "Open until 6 PM" shows only when hours are saved. When the clinic is closed, the emergency vet's Call button is
  the prominent one ("Closed now. Emergency vet: CityPets 24h, Call").
- Call = `tel:` link, Directions = `https://maps.apple.com/?q=<address>` (iPhone opens Apple Maps, others open Google Maps in the browser).

**"Is this an emergency?" (sheet from the vet card)**

```
┌───────────────────────────────────────┐
│ Call now if Chester…                  │
│ • isn't breathing normally            │
│ • strains in the litter box, nothing  │
│   comes out                           │
│ • …(today's RED_FLAGS list)           │
│                                       │
│ [ 📞 Call Maple Street Vet ]          │
│ [ 📞 Call CityPets 24h emergency ]    │
│ This app can't diagnose anything.     │
└───────────────────────────────────────┘
```

**Book a visit (sheet)**: one screen, then one action that saves *and* offers the calendar

```
┌───────────────────────────────────────┐
│ Book a visit                    ✕     │
│ Clinic   Maple Street Vet  ▾          │  ← from Your vet; the emergency vet in the list too
│ For      (Checkup)(Vaccines)(Sick)    │  ← chips, plus "Other…" to type
│          (Follow-up)(Other…)          │
│ Date     [ Tue, Nov 24 ]              │
│ Time     [ 10:30 AM ]                 │
│ Notes    (optional)                   │
│                                       │
│ [ Save and add to calendar ]          │  ← saves, then opens .ics (iPhone)
│   Add to Google Calendar instead ›    │     or the Google link (remembered choice)
│   Just save                        ›  │
└───────────────────────────────────────┘
```

- The calendar event carries the clinic's **address** (LOCATION), **phone** and a note ("Bring: vaccine card")
  in DESCRIPTION, with reminders the day before and 2 hours before.
- The choice of Apple or Google is remembered per phone, so the next booking is one button.
- The booked visit shows on Health as **Next** and in Coming up ("Vet: Booster, in 15 days"), and it doesn't count
  toward the yearly checkup reminder.

**After the visit**: the booked visit turns into the log entry

On the visit day, the Next visit line becomes **"How did Chester's visit go?"** with an **Add notes** button. The visit page opens with
the reason and clinic already there. Add what the vet said, the weight, any doses and **Add a document** (a
photo of the invoice or certificate), all linked to this visit. Nothing is typed twice.

**Visit page** (`#/health/visit/<id>`)

```
┌───────────────────────────────────────┐
│ ‹  Checkup + rabies                   │
│ Oct 20, 2026 · Maple Street Vet       │
│ [ 📞 Call ]  [ ➤ Directions ]         │
│                                       │
│ What the vet said                     │
│ Healthy, 7.0 lb.                      │
│                                       │
│ Given                                 │
│ ✓ Rabies (vaccine) · next Oct 2027    │
│ ✓ FVRCP (vaccine) · next Oct 2027     │
│ Weight 7.0 lb                         │
│                                       │
│ Documents                             │
│ 📄 Visit invoice Oct 20          ›    │
│ 📄 Rabies certificate            ›    │
│ [ + Add a document ]                  │
│                                       │
│ Edit · Delete                         │
└───────────────────────────────────────┘
```

**All documents** (`#/health/docs`)

```
┌───────────────────────────────────────┐
│ ‹  Documents                    [+]   │
│ [ 🔍 Search documents        ]        │
│ (All)(Vet)(Vaccines)(Adoption)(ESA)   │
│                                       │
│ Newest                                │
│ 📄 Visit invoice      Oct 20 · Visit ›│
│ 📄 Neuter discharge   Sep 12 · Visit ›│
│ 📄 ESA letter         Aug 1          ›│
│ …                                     │
└───────────────────────────────────────┘
```

- Tapping a document **opens it straight away** (no sheet first). Rename or delete lives under a "…" on each row.
- Search matches the title, the reader's summary and the linked visit's reason (all on the phone, no server).
- Health shows only the newest 3 documents and **All documents (5)**. Once at least one document exists, the long
  explanation of the adder shrinks to a single "+ Add a document" button.

**Summary for the vet** gains a header and documents

- Top: the vet and clinic (with phone), and the microchip. Visits can be tapped and show their notes, and the
  latest vaccine certificate is listed with a document link. Medicine rows go on two lines (name, then the dates) so
  nothing wraps into three lines.
- An **Email / Share** button (Web Share API) shares a plain-text version of the summary, for "send it before the
  appointment".

### 3.3 Flows, step by step

| Flow | Steps | Taps |
|---|---|---|
| Panic, vet open | Health → **Call** | 2 (1 from the Health tab) |
| Panic, at night | Health → **Call** (the emergency vet, shown first when the clinic is closed) | 2 |
| Panic, unsure | Health → Is this an emergency? → Call | 3 |
| Book + calendar | Health → Book a visit → reason chip → date → time → **Save and add to calendar** → Add (iOS sheet) | 6, no typing |
| Last checkup | Health → (it's on screen) → tap **Last** for details | 1–2 |
| Find a document | Health → All documents → (search or filter) → tap it | 3 |
| Show the vet | Health → Summary for the vet | 2 |
| After the visit | Health → "How did the visit go?" → notes / weight / doses / photo → Save | 3 + entries |
| First-time setup | Health → Add your vet → name, phone, address (paste a Google Maps link to fill them in, later) → Save | 2 + typing |

---

## 4. Data the feature session needs (SQL planning)

**New: `vets` (per household)**, shared by the household like pets:

| column | type | notes |
|---|---|---|
| `id` | uuid | |
| `household_id` | uuid | RLS: members of the household only |
| `kind` | text | `'primary'` \| `'emergency'` \| `'other'` (a groomer or specialist later) |
| `clinic` | text | "Maple Street Vet" |
| `vet_name` | text, null | "Dr. Patel" |
| `phone` | text, null | stored as typed; `tel:` built from digits |
| `address` | text, null | for Directions and the calendar LOCATION |
| `website` | text, null | |
| `hours` | jsonb, null | `{ mon: ['08:00','18:00'], … }`, for "Open until 6 PM" (optional; skip in v1 if needed) |
| `notes` | text, null | "Ask for Dr. Patel", "Parking behind" |
| `updated_at`, `deleted` | | same sync rules as care |

Idempotent migration (`create table if not exists`, policies `drop … if exists` then `create`), plus a pgTAP test
like the existing ones. Offline: same local table plus dirty-flag sync as `care`.

**Changes to existing care data (JSON in `care.data`, so no SQL change):**

- `vet`: add `vetId?` (which vet), `status?: 'booked' | 'done'` (missing = done), and `time?` (already exists).
  `reminders()` counts only `done` visits for the yearly checkup and lists `booked` ones in Coming up.
- `doc`: add `visitId?` (the visit it belongs to) and `type?: 'vaccine' | 'invoice' | 'lab' | 'discharge' | 'other'`
  on top of today's `categories`. A visit can have many documents. Keep `vet.doc` for old entries, and read it as a link the
  other way round.
- `med` / `weight` entered from a visit page: add `visitId?` so the visit page can show "Given" and "Weight".

**Migration of existing data (on the phone, once):** pick the most common `clinic` text from past visits and offer
"Is Maple Street Vet your vet? Add their phone number." That creates the first `vets` row from data people already
typed.

**Calendar (`src/lib/calendar.ts`)**: add a `phone` field to `CalEvent` (into DESCRIPTION), a second VALARM (`-PT2H`),
and a stable UID per visit (`visit-<id>@paldex`), so re-adding updates the event instead of duplicating it.

---

## 5. Suggested build order

1. **Your vet card + `vets` table** (Call, Directions, emergency vet, the red flags inside it). This alone fixes
   the panic case. *M, SQL.*
2. **Visits: Next / Last on Health, the Book a visit sheet with one Save-and-calendar action, booked vs done**, and the
   yearly-reminder bug fix. *M.*
3. **Visit page with linked documents, doses and weight; the after-visit prompt.** *M.*
4. **All documents: search, filters, newest 3 on Health, open on tap.** *S–M.*
5. **Summary for the vet: vet header, tappable visits, documents, Share.** *S.*
6. Later: paste a Google Maps link to fill in the vet's details, opening hours, a "Find an emergency vet near me" link
   (a maps search) when none is saved.

## 6. Open questions for Josh

- One vet per household, or one per pet (e.g. a specialist for one cat)? The proposal is **per household, with an
  optional "This pet sees…" override later**.
- Should booking a visit notify the rest of the household? It shows for them once synced, and push could come later.
- Is Apple Calendar (.ics) the main one for you, or Google? This decides the default button.
