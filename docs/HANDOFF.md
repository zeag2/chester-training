# PalDex: handoff

_Last updated 2026-11-11 (desktop steps 1–4 and 8 merged: side nav, sheets as dialogs / side panel, hover and focus rings, the centred screens, Home in two columns + the 160 px cat; step 5, Health in two columns + the log as a table + drag-and-drop documents, on branch `claude/features-desktop-health`). Start here when picking
the project back up._

PalDex (repo `chester-training`) is a phone web app for looking after a cat: **health tracking first** (weight,
symptoms, vet visits, medicine and vaccines, food, documents) and **clicker training as an optional extra per cat**,
shared with the people you live with, plus friends who can see each other's cats. It was built for Josh's kitten
**Chester** and his girlfriend **Megan**, and is now shared with friends.

- **Live:** **https://paldex-4qh.pages.dev/** (Cloudflare Pages, project `paldex`; `paldex` itself was taken, hence the
  suffix). Installable to the iPhone Home Screen. The old address https://zeag2.github.io/chester-training/ still
  works: it sends new visitors to the new one and shows existing users a "PalDex has a new home" card (`MOVED_TO` in
  `src/lib/moved.ts`).
- **Deploys:** every push to `main` deploys both: Cloudflare Pages builds it (`BASE_PATH=/`), and
  `.github/workflows/pages.yml` runs tests, builds and publishes the old GitHub Pages copy. Work happens on a
  `claude/…` branch (latest: `claude/practical-einstein-7eoqfi`) and goes live once it is merged or pushed to `main`.
- **Shared data:** Supabase project `vtcufhddooqzckjcpzwn`. URL and publishable key are in `src/sync/config.ts`
  (the publishable key is meant to be public; row-level security protects the data).
- **State at handoff (2026-11-09):** 143 tests passing in 27 files (154 in 29 on the vet steps 3–5 branch, 2026-11-10; 175 in 31 after the QA follow-ups; 183 in 32 after the audit fixes; 186 in 33 after the vet booking fixes; 195 in 33 after the booking polish), typecheck and build clean, everything on `main`
  and live (friend requests, the per-browser install guide, smart defaults and logging for all cats, playable laser
  and wand, zoomies sprint and backflip, the full-belly pose, the retimed walk). Branch:
  `claude/friend-request-acceptance-zytxm7`. All Supabase SQL
  through `20261114000000_friend_requests.sql` has been run (friend requests checked against the live database on
  2026-11-09: the table and all six functions exist and refuse signed-out callers). `20261115000000_vets.sql` has been
  run too (checked 2026-11-10: the table exists and refuses signed-out callers).

## Pick up here

1. **The cat redraw is live** (first pass, 2026-11-08, art session): every pose to the style guide, a cuter ball pose
   from Josh's references, and limbs that grow out of the body. Details and ideas for a second pass: section 2,
   item 2. Next: Josh looks at it on his phone; for the next art pass, attach the reference images again (a session
   can't see old uploads).
2. **Friends: visit and treat** is built and live (2026-11-08, branch `claude/friends-visit-treat`), and
   `20261111000000_friend_treats.sql` has been run (checked against the live database: the three functions exist and
   refuse signed-out callers). Next: try a treat between two real phones.
3. **Test on a real iPhone** with someone new: name and icon on the Home Screen, both cats carried into setup.
4. **Friend requests** are live (2026-11-09) and their SQL has been run. Next: try a request between two real phones,
   and check the per-browser Add to Home Screen steps on a real iPhone and Android phone.
5. Then the rest of section 2.


---

## Working in parallel sessions

Josh runs separate sessions at the same time. To keep them from colliding:

| Session | Owns (edits freely) | Must not edit |
|---|---|---|
| **Art & animation** | `src/chester/*` (art.ts, rig.ts, Chester.tsx, Chase.tsx, RainbowDash.tsx, reactions.ts, chester.css), the cat-only parts of `src/screens/Home.tsx` (the cats row, gag, chase, nuzzle), `docs/plans/2026-11-08-cat-art-style.md` | `src/db`, `src/sync`, `supabase/`, other screens |
| **Friends (visit + treat)** | `src/screens/Friends.tsx`, a new `src/screens/Visit.tsx`, `src/sync/*`, `src/db/store.ts`, `src/engine/corner.ts`, `supabase/migrations` + `supabase/tests`, the friends strip on Home (its own component, one line in `Home.tsx`) | `src/chester/*` (use `<Chester>` as is) |

- Each session works on **its own branch** (`claude/art-...` / `claude/friends-...`), and before pushing to `main` runs
  `git fetch origin main && git rebase origin/main`, then `npm test && npm run typecheck && npm run build`.
- `docs/HANDOFF.md`: each session edits only its own items (section 2 and its own part of section 1), so rebases merge.
- `Home.tsx` is shared: keep changes small and in separate spots (the art session near the cats row, the friends
  session one line adding `<FriendsStrip />` after the Today card).

## 1. What's built

### Layout (tracker first, training optional; plan in `docs/plans/2026-11-08-tracker-redesign.md`)
- **Tabs: Home · Health · + · Train · Me** (`src/ui/TabBar.tsx`). A red dot on Me means a new friend.
- **Wider windows** (desktop plan step 1, `docs/plans/2026-11-11-desktop-layout.md`): `useLayout()` in
  `src/ui/layout.ts` gives `phone` (under 760 px), `tablet` (760–1099) or `desktop` (1100+) from `matchMedia`.
  Phones keep the bottom tab bar exactly as before (`src/ui/layout.test.tsx` pins its markup to main's and checks
  every new CSS rule is keyed off the wide layouts). Tablet: an 88 px left rail, + at the top. Desktop: a 220 px side
  nav (PalDex, a "Log" button, the tabs, then the pet switcher; the switcher at the top of Home, Health and Train
  hides). TabBar sets `<html data-nav="rail|side">` while it shows, and the CSS moves the page over, drops the 110 px
  bottom pad and makes the column 640 px; `.screen.wide` opts a screen into up to 1120 px on desktop (for the
  two-column steps). Pages without the tab bar (a session, play) stay at phone width, centred. The "+N treats" note (`CareTreatNote`) centres on the page column and drops to the bottom when there's
  no tab bar. Screenshots: `docs/plans/img/2026-11-11-nav-*.png`.
- **Sheets** (desktop plan step 2): every form and sheet goes through `<Sheet label onClose>` in `src/ui/Sheet.tsx`
  (log forms, Log something, Book a visit, your vet / emergency vet, "Is this an emergency?", the quick-log fix list,
  the calendar choice, documents (the doc entry form), invite, Settings' sheets, Install, the icon note, the session
  restart). Phones (under 760 px): the same bottom sheet and the same wrapper markup (`overlay sheetbg` > `sheet`).
  Tablet: adds `dialog`, a centred dialog (520 px, at most 85vh, scrolls inside). Desktop: adds `panel`, a 420 px
  panel on the right with a lighter dim (dark mode: the panel is `--surface`). On both, a button with `sheetsave`
  (Save in the log form, Settings' pet and name, the vet form, Book a visit) sticks to the bottom of the dialog, on
  a band of the sheet's colour. Everywhere: Esc closes the top sheet (a calendar choice over Book a visit closes
  first), Tab/Shift+Tab stay inside, focus goes back to the opener on close; on tablet/desktop focus moves into the
  sheet on open unless a field has `autoFocus` (phones don't move focus). On tablet/desktop the page behind is scroll-locked while any sheet is open (`overflow:hidden` on `<html>`, padding for a classic scrollbar); phones scroll behind as before. Clicking the dim area closes, as before.
  New sheets: use `<Sheet>`, never the two divs by hand. CSS: the "Tablet and desktop sheets" block in app.css, every
  rule keyed off `.sheetbg.dialog` / `.sheetbg.panel` (pinned by `src/ui/sheet.test.tsx`). Toasts and the treats
  note keep step 1's places; they sit under the dim while a sheet is open. Screenshots:
  `docs/plans/img/2026-11-11-sheets-*.png`.
- **Home on desktop** (desktop plan step 4): at 1100 px and up Home uses `.screen.wide` and two columns
  (`.homecols`): left, the cat scene, Quick log + daily check, Today; right, the "new home" card, the icon note,
  Friends, Training, the corner card and the friend news. The greeting stays above both. The cat scene is the same SVG
  at **160 px** instead of 104; `homeScene(layout)` in `src/screens/Home.tsx` holds both sets of sizes (cat 104/160,
  the cats beside him 84/130, the bed 150/230, the chase's spacing 70/108, the bubble's lift 26/40) and the CSS block
  "Desktop Home" in app.css scales the px offsets around him by the same ×1.54 (nuzzle, overlap, bed, the chase's
  leap as `kchaseleapL`). The chase uses the column's width (up to 520 px) and a ball sized to the cat. The Quick log
  Undo toast (`.toast.undo`) sits at the bottom right of the content area on desktop. Phones and tablets render
  exactly the old markup (pinned by `src/screens/home.test.tsx`; a 390 px pixel diff against main is identical apart
  from the animated cats). The outline scales with the drawing (1.3 px at 104, about 2 px at 160, the same as the
  Corner's 150 px cat), so it stays even. Screenshots: `docs/plans/img/2026-11-11-step4-*.png`.
- **Health on desktop** (desktop plan step 5): at 1100 px and up Health uses `.screen.wide` and two columns
  (`.healthcols`): left, your vet, Visits, Summary for the vet, Coming up, Log something and the kitten plan; right,
  Documents (newest 3, All documents, + Add a document), Weight and Food and treats. The title, intro and setup card
  stay above both. Under them, **the Health log is a table** across both columns (`HealthLogTable` in
  `src/screens/Care.tsx`): Date · What · Details · Who, newest first, with the **last 7 days' quick logs** (Fed,
  Scooped, Played, daily checks, with their time) mixed in. "Who" shows only once someone else in the household has
  logged something (else it's a column of blanks). A row opens what the phone list opens: the visit page, the entry's
  form, or for a quick log the 7-day Quick logs sheet to fix it; "Quick logs, last 7 days ›" opens it too. The "What"
  cell is a real button, for the keyboard. **Drag and drop:** drop a photo or PDF anywhere on Health or All documents
  (every layout; only event handlers, so no markup change) and it goes to the same reader as "Add a document"
  (`useDocDrop` and `<DropNote>` in `src/ui/DocDrop.tsx`; `DocAdder` takes `dropped`). On All documents the adder
  opens. Other file types get "That file can't be read. Drop a photo or a PDF." Dragged text or links are ignored.
  No SQL. Phones and tablets render exactly the old markup (`src/screens/health.test.tsx`; Pillow diff of Health at
  390 and 900 px, main vs branch, light and dark: identical). Tablet stays one 640 px column with the list, as the brief says (two
  columns and the table are desktop only). CSS: the "Desktop Health" block in app.css, right after "Desktop Home"
  (it can't go at the end: the Desktop polish test reads to the end of the file), every rule keyed on `.healthcols`,
  `.healthcol`, `.healthlog` or `.dropnote`. Screenshots: `docs/plans/img/2026-11-11-step5-health-*.png`.
- **Hover, focus rings, centred screens** (desktop plan steps 3 and 8): the "Desktop polish" block at the end of
  app.css. Under `(hover:hover)`: `cursor:pointer` on links, labels, selects, checkboxes; a hover tint on buttons,
  cards, chips, rows, icon buttons, tabs, the vet cards and switches, laid over the element's own colour as a
  `background-image` (`--hov`: darker in light, lighter in dark; `--hov-ink`, the reverse, on ink buttons such as
  `.btn`, the selected chip and the + / Log). Under `(hover:hover)` or 760 px and up: a 2 px `--ink` `:focus-visible`
  ring, 2 px out (just inside for rows in clipped or scrolling groups). Settings, Week, Trophies and Library already
  got the 640 px column from step 1; Onboarding and Install (no nav) opt in with `.screen.centred` (640 px from 760 px
  up). `src/ui/layout.test.tsx` checks every rule in the block sits in one of those media queries, so phones are
  untouched (Pillow diff of five phone screens vs main: identical but for the cat's wave). No tooltips yet (brief §4,
  icon-only buttons). Screenshots: `docs/plans/img/2026-11-11-polish-*.png`.
- **Home**: the cat(s) (faces to switch: `src/ui/PetSwitcher.tsx`), a **Today** card (what's due, last weight with
  change, quick-log buttons: `TodayCard` in `Care.tsx`), a small Training card only for cats with training on, the
  corner, friends.
- **Health** (`#/health`, the old Care page): `#/health/log/<kind>` opens a log form straight away.
- **+** (`QuickLog.tsx`): weight, symptom, food, vet, medicine, grooming, a document, and a training set (if on).
- **Train** (`Train.tsx`): today's sets, stats, chart, learning now, then Skill tree, Library and the corner. A cat with
  training off sees a "Turn on training" card. `Cat.training` (missing = on); asked per cat at setup, switchable in
  Train and in each cat's edit sheet.
- **Me** (`Settings.tsx`, `#/me`): Your cats, People (friends, household), Account, App, Your data.

### Training (Phase 1, from `docs/plans/2026-11-07-chester-phase1.md`)
- **Onboarding:** Welcome, then "How are you joining?": **Set up my cat** (account, then pet questions) or **Someone
  invited me** (account, then invite code, then straight to the shared pets). Asks boy or girl. Setup starts empty,
  not with Chester's details.
- **Session:** the whole screen is a "Yes!" paw button, with a yarn-ball 2-minute timer, Missed/Pause/End, and a draft
  saved on every rep so a killed app resumes. **↻ next to the clock restarts the timer** (asks whether to keep or clear
  the reps when there are some); at 0:00 the Pause button becomes "Go again".
- **Recap and rewards:** good-rep count, mood, the pass rules, treats and a gift per set, and a celebration on a step up
  or a mastered skill.
- **Skill tree and library:** skills by branch, with steps, tips and sources. Hidden skills unlock by mastery
  (check-ins aren't built yet).
- **Rules** (`src/engine/rules.ts`, `rewards.ts`): a pass is at least 5 reps, at least 80% good, and not Stressed.
  Two passes in a row move up a step. At most 3 rewarded sets a day, 1 treat per good rep, and at most 30 treats a day.

### Sharing: households
- Accounts use **email and password** (Supabase Auth, "Confirm email" turned **off**; see the decisions section).
- A **household** holds people and pets. Its people see and train every pet in it. There's **one invite code per
  household**, and pets added later are shared automatically.
- Whoever set the household up can **remove** people (Settings, then the person, then Remove from household); anyone
  can **leave**. Sets they logged stay.
- Settings shows each person's email and how many sets they've logged, and flags two people with the same name as a
  likely duplicate account.
- Each phone greets whoever is signed in on it ("Good morning, Josh"), and Home says "Training Chester with Megan".
  The remembered name is stored **per account**, not per phone.
- Works offline: sets and care save on the phone and sync when back online, never doubled.

### Friends (`#/friends`, from Me, Home's Friends card and its +)
- Every account has a **friend code**. Entering someone's code **sends them a request** (since 2026-11-09,
  `20261114000000_friend_requests.sql`): they see "Erin wants to be friends. Accept?" on Home's friends card and at the
  top of Friends, and a red dot on Me ("Request" on Me's Friends row). **Accept** makes you friends both ways; **Not
  now** is quiet (the request stays, marked declined: the sender still sees "Waiting to accept", and sending again
  doesn't ask twice). Entering the code of someone who already asked you accepts straight away. Senders can **Cancel**
  under "Waiting to accept". At most 30 open requests per person. The old `add_friend` now sends a request too, so
  older app versions can't skip it. Before that SQL is run, codes make friends straight away (the app falls back to
  `add_friend`; `friendRequests()` returns []). Incoming requests are checked when Friends loads and on sync (at most
  once a minute, `store.requests`).
- Either side can remove a friend: on Friends ("Your friends") or at the bottom of a friend's cat's **Visit** page
  ("Remove friend", with a confirm). Removing also clears requests between you, so either can ask again.
- **Friend bonus:** each new friend gives the pet being shown +15 treats and +1 bond, once per friend, for the first
  10 friends (`FRIEND_BONUS`, `unrewardedFriends` in `corner.ts`; logged as `friend-<their id>` so re-adding doesn't pay
  again). Both sides get it: the person adding right away, the other when their friends are next checked (opening
  Friends, or a check during sync every 10 minutes). The first friend unlocks the **Friendship scarf**, an outfit
  that can't be bought. Home shows a "new friend" card with Put the scarf on / See their cats.
- **Invite:** a **+** on Home's Friends card and on the Friends screen opens an invite sheet (code, Send an invite,
  Copy code, add a code). Invite links are `<app>#/friends/<CODE>`: opening one fills the code in, and it's kept
  (`src/lib/invite.ts`) while a new friend sets up the app and signs in.
- Friends see a **card** for each of each other's pets: look, outfit, age, skills mastered, streak, sets this week,
  bond. Never the pet record, care, documents or training sets. Each household publishes its pet's card on sync
  (`cardFor`/`publishCard` in `store.ts`, `set_pet_card` in SQL); `friend_pets()` returns only the card plus name and look.
- Needs `20261110000000_friends.sql` (run it in the Supabase SQL editor). Until then the screen says friends aren't
  switched on yet; nothing else is affected.
- **Friends' cats strip on Home** (`src/ui/FriendsStrip.tsx`, one line after the Today card in `Home.tsx`): Home's only
  friends card (the older "Friends' cats" card was merged into it on 2026-11-08). Since 2026-11-09 it shows **one tile
  per friend** (`households()` groups `friends.pets` by owner): their cats sitting together on a little floor, then
  "Erin's" and "Bijou & Billie" (up to 4 cats, then +N); tap a cat to visit it; a paw badge on each cat that can still
  get today's treat; + to invite (opens the invite sheet). The Friends screen ("See all") still lists cats one card each. It also shows "Erin gave Chester a treat" (`treatNews` in the store).
- **Visiting** (`#/visit/<catId>`, `src/screens/Visit.tsx`, also from each card on the Friends screen): the friend's cat
  big and pettable with the usual reactions (`<Chester interactive>` with the card's coat, eyes and outfit), plus the
  card's skills, streak and bond.
- **Free treats:** once a day per friend's cat (the giver's local day). The server enforces it
  (`friend_treats`, `give_treat(c, d)` only for friends' pets and only within a day of the server's date;
  `treats_given(d)` for "Given today"; `treats_for(c)` for the pet's household, last 30 days). The owner's phones turn
  each into a corner log entry `treat-<from>-<day>` (+1 treat, `by` = the giver) on sync (at most once a minute per
  pet) and whenever Friends loads (`collectTreats` in `store.ts`, `newTreats` in `corner.ts`); merging by id means
  two phones in the household never count one twice.
- Needs `20261111000000_friend_treats.sql`. Until it's run, visiting still works and the treat card says "Treats aren't
  switched on yet" (`friends.treats === 'missing'`); the strip shows no treat badges.

### Multiple pets
- Settings, then Pets, then **Add another pet** (pet questions only). A switcher shows on Home when there's more than
  one pet. The pet being shown is remembered.
- Each pet has its own training, care log and documents. New pets go into the household of the pet being shown.
- **Cats only.** Dogs would need new art and a new skill set (see section 5).

### Quick log and daily check (Home, `src/ui/DailyTaps.tsx`; added 2026-11-08)
- **Fed / Scooped / Played:** one tap each logs "now, by me" as a care item of kind `daily` (`{ what: 'fed' | 'scoop'
  | 'play' }`), with a 5-second Undo instead of a form. Tiles show today's state: "1 of 2 · 7:40 by Megan" (meals a day
  = `Cat.mealsPerDay`, default `MEALS_PER_DAY` = 2, set in each cat's Edit sheet). After Scooped, the Undo note also
  offers "Looked off?" (logs a Litter box change symptom and opens Health), "Not yet today", "2× today".
- **Daily check:** "Is Chester eating, using the litter box and acting like himself?" **All normal** (one tap) or
  **Something's off** (logs it, then the card turns into **What's off?**: symptom chips with the likely ones
  preselected, so Save is one more tap; `likelySymptoms()` in `care.ts` preselects anything logged in the last 3 days
  and offers Eating less / Litter box change / Low energy next; "Other or details…" opens the full form). Each chosen
  chip is saved as its own symptom. Once done it shrinks to one line.
- **Fixing a mistaken tap later** (2026-11-10, `src/ui/DailyLogSheet.tsx`, branch `claude/features-edit-logs`): a
  **done** tile (e.g. "Fed 2 of 2", "Scooped 8:15", "Played 1×") opens that kind's entries for today instead of
  logging again, with **Log another meal** / Scooped again / Played again at the bottom for a real extra one. Under the
  tiles, **"Logged by mistake? Fix today's entries"** (shown once anything is logged today) opens all of today's quick
  logs, the daily check included. Each row has a time to change (same day; `atTimeOfDay()` in
  `src/engine/dailylog.ts`) and a delete with an inline **Keep / Delete** confirm. It's the shown cat's entries; switch
  cats for the other's. Deletes go through `store.deleteCare` (the soft delete Undo uses) and time changes through
  `store.saveCare` with the item's id and `catId`, so both sync like any care edit; no new SQL. Deleting a "something
  was off" check leaves its symptoms (they're in Health's log, deletable there). Health's log has a **Quick logs** row
  that opens the same sheet for the last 7 days, grouped by day (`dailyLogDays()`). Opening the sheet from Home closes the Undo toast
  (it would sit hidden behind the sheet and come back stale), and the sheet closes when the shown cat changes.
- **The Undo note is a floating toast** (`.toast` in `app.css`, portalled to `body`) just above the tab bar, on one row
  however many cats (the label ellipsizes; the buttons don't wrap). Since 2026-11-10.
- One-tap logs earn care treats like any entry (capped at 3 a day) and aren't listed in Health's log
  (`dailyToday()` in `care.ts` sums them up for Home).
- **Shortcuts:** `#/log/fed|scoop|play|check` logs it and returns to Home (`LogLink`). The manifest's `shortcuts`
  offer them on a long-press of the app icon (Android; iPhone ignores manifest shortcuts, and links from iPhone
  Shortcuts open in Safari, not the Home Screen app).
- **`20261112000000_daily_logs.sql` has been run (2026-11-09)** (adds `daily` to the care kinds). Before it was run, one-tap logs stay on the
  phone that made them (`syncCare` pushes them separately and keeps them dirty on a check-constraint error) and
  everything else kept syncing; they upload once it's run (that fallback stays in place for new Supabase projects).

### Health (the Health tab, `#/health`; was "Chester's care")
- **Vet first (2026-11-09, steps 1–2 of `docs/plans/2026-11-09-vet-redesign.md`, by the UX auditor, PR #2):** the top
  of Health is `VetCard` and `VisitsCard` (`src/ui/VetCards.tsx`). **Your vet**: clinic, vet's name, address, one-tap
  **Call** (`tel:`) and **Directions** (Apple Maps link), the **emergency vet** with its own Call, and **Is this an
  emergency?** (the red flags with both call buttons; replaces the old "When to call the vet now" card). With no vet
  saved: "Is <clinic you typed most> your vet?" (`suggestClinic`) or Add your vet. Vets are a household table
  (`vets`, `src/engine/vets.ts`, synced newest-wins with tombstones like care; kept on the phone and joined to the
  household on sharing; `vetsSync: 'missing'` until `20261115000000_vets.sql` is run). **Visits**: Next (with Add to
  calendar), "How did Chester's visit go?" once a booked day has passed (opens the visit to add notes; saving marks it
  done), Last, and **Book a visit** (clinic chips from your vets or somewhere else, reason chips, date, time, notes;
  **Save and add to calendar**: Apple .ics by default, Google remembered per phone; the event has the clinic's address
  as the place, the phone in the notes, reminders the day before and 2 h before, and a stable UID per visit). Visits
  carry `status: 'booked' | 'done'` and `vetId` in their care data; `reminders()` lists booked visits in Coming up and
  no longer counts them as the last checkup (the bug the audit found).
- **Booking fixes (2026-11-10, Josh's feedback, Features worker, branch `claude/features-vet-booking-fixes`):**
  - **Bug: spaces couldn't be typed** in Book a visit's clinic name. The "Somewhere else" input used a `' '` sentinel
    in its state and showed `other.trim()` as its value, so every trailing space was erased on the next render. The
    free-typed clinic is gone (below); the new fields keep exactly what's typed and trim only on save
    (`src/ui/booking.test.tsx` types "Maple Street Vet" a keystroke at a time).
  - **The vet:** Book a visit shows the household vet (and the emergency vet) as a selectable card. With no vet saved,
    **+ Add vet** opens name, phone and address right in the sheet; saving the visit saves them as the household's
    vet (`kind: 'primary'`, prefilled with `suggestClinic`) and links the visit to it. You can still book with no vet.
  - **Which calendar is asked**, never assumed: the sheet has Apple Calendar / Google Calendar / Don't add, with the
    phone's last choice preselected (`paldex-calendar` in localStorage; nothing preselected the first time, and Save
    waits for a pick). Every other Add to calendar (Health's Next visit, the visit page, Coming up) opens **"Add to
    which calendar?"** with the last-used one first (`src/ui/CalendarChoice.tsx`: `CalendarSheet`, `addToCalendar`,
    `lastCalendar`). Apple = the .ics; Google = `calendar.google.com/calendar/render?action=TEMPLATE` with title,
    dates, `ctz` (the phone's time zone, so a 2:30 PM visit lands at 2:30 PM local), location and details. The Log something vet sheet's buttons now read Apple Calendar / Google Calendar.
- **Booking polish (2026-11-10, from the booking research, Features worker, branch `claude/features-booking-polish`;
  no SQL: the new fields live in the care JSON):**
  - **Call at the top** of Book a visit when the picked clinic has a phone: "Call the clinic, then record what they
    gave you."
  - **Prefilled from what's due:** Coming up's yearly checkup and vaccine boosters have a **Book** button (instead of
    the calendar one) that opens the sheet with the reason (Checkup / Vaccines), a note ("FVRCP booster due Nov 24")
    and a date near the due date (`bookingDay`: the due day, or tomorrow if past, never a Sunday). After a visit, its
    page offers **"Book the next one?"** for the soonest vaccine it gave that's due again (`nextVaccines`; hidden
    while a visit is already booked). `BookSheet` takes a `preset`; `Reminder` now has `what` for medicines.
  - **Quick times:** 9:00, 10:30, 2:00, 4:30 and Other… (the phone's time picker) above the notes; no time means
    all-day, and the sheet says so.
  - **Toast after saving** (`src/ui/Toast.tsx`: `showToast`, `<ToastHost />` in `App.tsx`): "Booked Tue, Nov 24,
    10:30 AM · Added to calendar", with **Undo** (deletes the visit; then "Delete it from your calendar too", since
    the event can't be taken back).
  - **Offline + Google:** the sheet says the Google link will work once online and saves without opening a dead tab
    (Apple's .ics works offline); the toast says to add it later (Next visit's calendar button).
  - **Accessibility:** `aria-pressed` on the reason and time chips; Save says why it's disabled underneath (linked by
    `aria-describedby`): no clinic name, no reason, no date, no calendar picked.
  - **A week-before reminder** for visits more than 7 days out (`weekBefore` in `src/lib/calendar.ts`): an extra
    `VALARM` in the .ics, and a "Reminder: a week before, …" line in the Google details (Google links can't set
    reminders).
  - **+ Other clinic:** a one-off visit somewhere else (name, optional phone and address), kept on the visit only
    (`phone`, `address` on the vet care data); your vet stays the same. The visit page's Call and Directions use them.
  - **Errors:** if saving the vet or the visit throws, the sheet stays open, the pre-opened Google tab is closed, Save
    works again, and it says so. A vet added in the sheet is kept, so a retry doesn't add it twice.
  - **No address:** the calendar place is the clinic's name and the notes no longer repeat it (`visitEvent`).
  - **One toast at a time (QA fix):** Health's "+N treats for logging" note moves up above the booking toast
    while one shows (`useToast`), so it doesn't cover Undo; Home's Quick log Undo hides a booking toast still showing.
    Undo removes the visit but not the treats it earned (as with any deleted care entry).
- **Booking part 2a: reschedule and cancel (2026-11-11, Features worker, branch `claude/features-booking-2a`; no SQL:
  `status: 'cancelled'` and `calSeq` live in the care JSON):**
  - A booked, upcoming visit's page has **Reschedule** (new day and time; clearing the time makes it all-day) and
    **Cancel visit** (confirm; the visit stays, with a **Cancelled** chip, **Book again** and **Remove from
    calendar**). Each change bumps the visit's `calSeq`.
  - Then **"Move it in your calendar?" / "Remove it from your calendar?"** (`CalendarSheet` with `change`). Apple
    re-sends the .ics with the **same UID** (`visit-<id>@paldex`) and `SEQUENCE:<calSeq>`; a cancel sends
    `STATUS:CANCELLED`, no alarms, and "Cancelled: " in the title (so even if iOS adds it as a new event instead of
    updating, it reads as cancelled). Every .ics now carries `SEQUENCE` and `STATUS:CONFIRMED`. Google links can only
    add: a reschedule opens the new time and the toast says to delete the old one; a cancel opens nothing and the
    toast says to delete it in Google Calendar. "It's not in a calendar" skips.
  - A cancelled visit is left out everywhere a visit counts (`isCancelled` in `src/engine/care.ts`): Coming up, the
    yearly checkup, `isBooked`/`visits()` (Next visit, last visit), the kitten plan and the weekly recap. Editing a
    cancelled visit keeps it cancelled. Tests: `src/screens/reschedule.test.tsx`.
  - **For Josh on a real iPhone (Home Screen app):** book a visit with Apple Calendar, then Reschedule → Apple: does
    Calendar *move* the event (not add a second one)? Then Cancel → Apple: is the event removed or marked cancelled,
    and its reminders gone? If iOS duplicates instead, tell the PM (the fallback is to say "delete the old one" as for
    Google).
- **Visits, documents and the summary (2026-11-10, steps 3–5, Features worker, branch
  `claude/features-vet-redesign-3-5`):** links live in the care JSON, so **no SQL**: `visitId` on `doc`, `med` and
  `weight`, and `type` on `doc` (`vaccine | invoice | lab | discharge | other`, guessed by `guessDocType` when a
  document is read). Older entries are read the other way round: a visit's `doc`, and doses/weights saved from the same
  document (`visitLinks`, `visitOfDoc`, `findDocs` in `src/engine/docs.ts`).
  - **Visit page** (`#/health/visit/<id>`, `src/screens/VisitPage.tsx`): date, time, clinic, Call / Directions (the
    visit's vet, else your vet when the clinic matches), Booked + Add to calendar, "How did it go?" once the day has
    passed, What the vet said, **Given** (doses and the weight; + Dose or vaccine / + Weight log them linked to the visit
    on its day), **Documents** (+ Add a document reads it as usual, but links the document, doses and weight to this
    visit and offers what the vet said for this visit's notes instead of a new visit), Edit / Delete. Every visit opens
    it: Health's Next/Last, Coming up, the Health log and the summary.
  - **Documents:** Health shows the newest 3 and **All documents (n)**; once there's one, the adder is a single
    "+ Add a document" button. **All documents** (`#/health/docs`, `src/screens/Documents.tsx`): search (title, the
    reader's summary, the visit's reason, clinic and notes; all on the phone), filters All / Vet / Vaccines / Adoption /
    ESA, newest first. **Tapping a document opens it**; "…" opens the sheet to rename, link it to a visit ("From the
    visit"), go to the visit, or delete. Shared row and opener: `src/ui/DocRow.tsx`. A document read as a visit is
    linked to the visit it created.
  - **Summary for the vet** (`#/vet-summary`): your vet's clinic, name and phone (with Call) under the pet's line,
    medicine rows on two lines, recent visits (done only) that open the visit page with their notes and document
    count, the next booked visit, the newest vaccine paperwork then the newest documents (tap opens), and **Share**
    (the Web Share sheet with a plain-text version, `summaryText()`; copies to the clipboard where sharing isn't
    available).
- **When to call the vet now:** red-flag signs, with a clear "this app doesn't diagnose".
- **Coming up:** medicine and vaccine due dates, nails and brushing getting overdue (once started), and the yearly
  checkup. The yearly checkup counts from the newest visit whose day has come (a past booking counts even before
  "How did it go?" is answered), and **a visit booked from today on satisfies it**: the booking is listed instead,
  never a reminder a year past it (fixed 2026-11-10).
- **Order (2026-11-10):** Your vet, Visits, Summary for the vet, Coming up, **Log something**, then the kitten
  timeline (was after it), Weight, Food, Documents, the log.
- **Log something:** weight (with a chart), symptoms (quick picks plus "we're worried"), grooming, vet visits,
  medicine and vaccines with a next-due date.
- **Food and treats:** Loves it / It's OK / Won't eat it, and "using now". **Find it** looks a product up by barcode
  scan, typed barcode or name in Open Pet Food Facts (free, no key).
- **Documents:** upload a photo or a multi-page PDF. It's **read on the phone with rules** (no AI, no cost), and the
  user checks each suggestion before it's saved:
  - **Pages:** each page is sorted as **Vet**, **Adoption** or **ESA & housing**.
  - **Doses:** every dose is kept (vaccines, flea, dewormer, medicine), with given and next-due dates.
  - **Tests and surgery:** tests with results (FeLV/FIV) and surgeries (neuter/spay) are logged as visits.
  - **Weigh-ins:** read from weight lines and weight tables.
  - **Profile:** suggests birthday, microchip, spayed/neutered, and "home since" from the adoption contract.
  - **What it ignores:** nothing medical or personal is taken from ESA/housing or adoption wording. Vial lot and
    expiry dates aren't treated as due dates.
  - **Storage:** files go in the private `pet-docs` bucket, readable by household members only.

### Chester's corner (`#/corner`, under Train, from Home's yellow card, or "Spend treats" after a set)
- **Spend treats** on 6 outfits (bell collar, bow tie, bandana, ear flower, party hat, crown), 3 toys (box, laser dot,
  crinkle tunnel) and 3 cushions (mint, heart, cloud). Catalogue and prices: `SHOP` in `src/engine/corner.ts`.
- **Outfits show everywhere** Chester appears for that pet (Home, session, recap, settings, skill pages). They're
  drawn in head coordinates in `outfit()` in `src/chester/art.ts`, so they follow every pose, the rig and petting.
  Tap a worn outfit or cushion again to take it off.
- **Treats for care** (`CARE_TREATS`, `careReward` in `corner.ts`; `rewardCare` in `store.ts`): every new care entry
  earns +2, up to 3 entries a day (the household shares the cap). Bonuses: +5 for a weigh-in (once a week, only for a
  weigh-in from today or yesterday), +3 for a medicine or vaccine given on or before the due date the last dose set,
  +5 for a vet visit from the last week. Logged as `care-<care item id>`, so edits and other phones never pay again;
  deleting an entry keeps its treats. A "+7 treats for this week's weigh-in" note shows on Health
  (`src/ui/CareTreatNote.tsx`). No SQL.
- **Daily gift:** 2 to 6 treats once a day per pet, the same amount on every phone, shared by the household (whoever
  opens it first gets it). Home shows "New" until it's opened.
- **Play:** the laser dot, feather wand, box and tunnel each open their own game (`#/play/<toy>`, section 2 "Play");
  other gifted toys (crinkle ball, toy mouse…) still just play a move (hop, pounce, play bite, belly roll). The first
  play each day adds 1 bond.
- **Bond level:** 6 named levels (Getting to know you, Buddies, Pals, Best friends, Partners in crime, Soulmates)
  with a progress bar. Bond comes from gifts in sets plus daily play.
- **How it's stored and shared:** on the pet itself (`cat.corner`), which is already shared as JSON, so **no new SQL**.
  Buys, gifts and plays are an append-only log merged by id on sync (two phones never lose each other's buys; the
  gift and play ids are per day, so they can't be claimed twice). The outfit and cushion choice carry their own
  `styledAt`, so an unrelated edit on another phone never undoes them. Balance = treats from sets + the log.

### Chester himself (the character)
_How it works under the hood (SVG, CSS layers, the rig, the component, scenes): section 3a._
- **Physics rig** (`src/chester/rig.ts`): springs drive every pose. The body leans from the hips, the head and ears
  follow a beat late, and the tail is a 9-joint chain.
- **Petting:** drag across him and he leans into your finger, eyes happily closed, purring. Lying down, he nuzzles.
- **Moves on the rig:** hop, pounce, dance and yarn batting, each with wind-up, stretch, tucked legs and a landing
  squash.
- **Tap reactions:** hop, purr, flop, chin scratch, play bite, head bonk, mlem, sneeze, meow, zoomies and more. Only
  gentle ones play when he's lying, loafing or kneading.
- **Eyes and walking:** real eyelid blinks, and a diagonal-pair walk cycle (retimed 2026-11-09 to Josh's SVGator
  reference: a calmer 0.8 s stride with a bob twice a stride). While walking the head stays level as the body
  bobs under it.
- **Head size:** `HEAD_SIZE.scale` in `src/chester/art.ts` (0.88) times each pose's own `size` (sit 0.84, walk 0.82…).
  It scales about the neck, so every pose, the rig and the outfits follow.
- **Cats together on Home:** the other cats (up to two) sit beside the one being shown (tap to switch to them), nuzzle
  cheek to cheek now and then, and every minute or two (or on the yarn button) a **toy chase** plays: a yarn ball rolls in,
  everyone runs after it, it's batted back, the lead cat pounces, they trot home (`src/chester/Chase.tsx`, ~6 s).
  Works with one cat too.
- **Life on Home:**
  - Sits by default and makes biscuits for about 7 seconds every 25 to 55 seconds.
  - Dozes after 90 seconds alone.
  - Sleeps from **10:30 PM to 5 AM**; a tap wakes him (sleepy) for two minutes.
  - Random meows every 25 to 70 seconds.
  - The **off-screen litter box gag** every 3 to 6 minutes: a shifty glance over his shoulder ("Be right back."), he
    walks all the way off, digging is heard, horizontal stink lines drift in from the right, he runs back and puffs
    his chest out, proud (no meows or biscuits interrupt it). Sequence in `useHomeLife` in `src/screens/Home.tsx`; he
    zooms back and owns it.
- **Zoomies** (a rare tap reaction, and the crinkle tunnel): a real sprint now, not the sitting cat sliding: he
  gallops off one side, tears back in from the other, leaps into a tucked backflip, lands and skids to a stop
  (`Zoomies.tsx`, ~2.7 s). From Josh's reference GIFs (qualities only): a rotary gallop and a curled spinning flip.
- **His bed:** buy a cushion or bed in the corner and he sits on it on Home, kneads into it, and rests on it in a loaf.
- **Roll:** a front-on splat that rolls over sideways onto his back and round again (from Josh's reference).
- **Full after a meal:** tap Fed and he sits round and content for a few seconds, eyes closed, patting his belly,
  with a little puff of air (the `full` pose; from Josh's picture of a satisfied chubby cat, qualities only).
- **Rainbow dash:** tap him 8 times in 3 seconds. He flies across twice in a **fly** pose on a pastel ribbon (wearing his
  outfit). Each 3.8 s pass swoops in fast, glides slowly across, zips out fast (`PASS_MS` in `RainbowDash.tsx`;
  keyframes follow Chester, not the long trail). The original 8-bit tune is fitted to the whole dash (~7.6 s), and is deliberately not the Nyan Cat song.
- **Sounds after switching apps:** iPhone pauses the audio engine in the background (it comes back 'interrupted') and
  only restarts it from a tap. `keepAlive()` in `audio.ts` pauses it cleanly when hidden, restarts it on the next tap,
  and replaces it if it stays stuck.
- **Sounds:** clicker and reward are recorded samples (`public/sfx`). Chirp, purr, meow, litter digging and the tune
  are synthesized in `src/lib/audio.ts`.

### Getting it onto phones
- **First visit on a phone's browser** shows "Hi! Who's your kitten?": type one or more names, then **Add to Home
  Screen**. Android/Chrome shows its own install prompt from the button; iPhone has no such API, so the button opens a
  step-by-step guide. "Not now" continues in the browser (`src/screens/Install.tsx`, `src/lib/install.ts`).
- **The guide is per browser** (2026-11-09, `src/ui/InstallSteps.tsx`, `browser()` in `install.ts`): the steps differ
  by browser, so it guesses from the user agent and shows chips to switch (iPhone: Safari, Chrome, Firefox, Edge;
  Android: Chrome, Samsung Internet, Firefox, Edge). A browser inside another app (Instagram, Facebook, TikTok, the
  Google app…) can't add to the Home Screen at all, so it says "Another app" and how to open the page in Safari or
  Chrome first. The same guide is behind Me → "Add … to your Home Screen". The menu names were written from each
  browser's current layout but **not checked on real phones**; adjust the wording in `steps()` if one differs.
- **The app is named after the kittens** ("Chester", "Chester & Luna") on the tab, the iPhone Home Screen title and
  the install manifest (`src/lib/appname.ts`). An iPhone Home Screen app doesn't share storage with Safari, so the names
  ride into the installed app in the start address (`?pets=Chester,Luna`), and setup walks through each kitten in turn.
  An icon already on a Home Screen keeps its old name (long-press to rename, or remove and add it again).
- **"Your Home Screen icon still shows the old cats"** (2026-11-10, `src/ui/HomeIconNote.tsx`, on Home): in the
  installed iPhone app only (standalone and iOS; never in Safari tabs or on Android, which updates from the manifest),
  the app remembers the cats it first ran with (`rememberHomeLook`, `paldex-homescreen-look`: all the names and the
  first two cats' coat and eyes). When those change, Home shows the note once per change (Close or Got it stores
  `paldex-homescreen-note`). **Show me how** opens the steps: sign in first if not signed in (removing the icon
  removes what's only on the phone), remove the icon, open the site in Safari, then the usual Add to Home Screen guide.
  Not checked on a real iPhone (`Remove App` wording, and whether re-adding gives a fresh storage, which resets it).
- **Barcode scanner** (`src/screens/Scanner.tsx`): the camera starts once (it used to restart whenever the Care screen
  re-rendered), asks for a sharp focused rear camera, reads only UPC/EAN, uses the phone's own reader where available,
  checks the check digit, and has a flashlight button.
- **Barcode lookup** (`byBarcode` in `src/lib/petfood.ts`): your own saved foods first (instant, offline, shared with the
  household), then Open Pet Food Facts, then Open Food Facts. Both open databases allow browser requests (CORS `*`)
  and accept a 12-digit UPC as is. **Their US coverage is thin** (about 50 Fancy Feast products, 3 Blue Buffalo), so
  many scans come back "not found": the barcode is then saved with the food the person types in, and the next scan
  of that bag fills in from their list. UPCitemdb was tested and ruled out (no CORS for other sites, rate-limited).
  Better coverage would need a paid UPC API behind a Supabase Edge Function (to keep its key secret).

### App
- **Dark mode:** Settings, then Appearance (Match phone / Light / Dark). Colors are tokens in `src/styles/app.css`.
- **Settings:** grouped like iPhone Settings: pet card with an Edit sheet, Pets, Household, App (Sound switch,
  Appearance), Your data (backup JSON including care).
- **Updates itself:** checks for a new version whenever the app returns to the front and applies it straight away,
  except mid-session or recap (`src/lib/updates.ts`). No more close-and-reopen.
- Renamed to **PalDex** (home-screen name, title, manifest). The URL path stays `/chester-training/` so installs don't
  break.

---

## 2. What's left (checklist)

Tick items here when they ship (`[x]`), in the same commit. Sizes: S under an hour, M about a session, L several.
"SQL" means Josh runs a migration. Suggested order: badges, bond unlocks + nap tokens, weekly recap, vet summary, push.
Items marked *(art)* suit the art session.

### Agenda (agreed with Josh, 2026-11-09; work top-down, tick here and in the checklist below)
1. [x] **Smart defaults + log for several cats at once** (done 2026-11-09). Make logging effortless.
2. [x] **Playable toys, part 1: laser dot and wand** (done 2026-11-09). See "Play" below.
3. [x] **Playable toys, part 2: box and tunnel** (done 2026-11-10, branch `claude/features-box-tunnel`). See "Play" below.
- [ ] **Security review + Forgot password** (M, SQL; Josh, 2026-11-11; before the photo feed): check access rules
   (RLS) on every table and storage bucket with policy tests, auth settings (email confirmation, rate limits, leaked
   password protection), security headers, dependency and secret scanning; add "Forgot password?" on sign-in
   (Supabase reset email + a set-new-password screen; Josh adds the redirect URL in Supabase). Later, before charging
   or the App Store: privacy policy and delete-my-account. Free tier has no backups: decide on Pro or a manual export.
4. [ ] **Photo feed: your cats and friends' cats** (L, SQL). See "Photo feed" below. Replaces the Photo album item.
5. [ ] **Push notifications** (L, SQL): worth it once the feed exists ("Erin posted Mochi", friend requests, treats,
   medicine due).
6. [ ] **Medicine reminders** (M): in-app first, then as push notifications.
7. [x] **Vet redesign, steps 3–5** (done 2026-11-10, pull request from `claude/features-vet-redesign-3-5`; no SQL) (Josh, 2026-11-09; plan `docs/plans/2026-11-09-vet-redesign.md`, steps 1–2 done):
   a page per visit (`#/health/visit/<id>`) with its documents, doses and weight linked by `visitId`; All documents
   (search, filters, newest 3 on Health, open on tap); Summary for the vet with the vet header, documents and Share.
   Josh's answers: one vet per household (per-pet override later), no household notifications beyond sync, Apple
   Calendar as the default.
8. [ ] **Booking, part 2** (M each; Josh, 2026-11-10, from the booking research): reschedule and cancel from the
   visit page (re-send the .ics with the same UID and SEQUENCE+1, or STATUS:CANCELLED; test on a real iPhone)
   **(part 2a done 2026-11-11, PR from `claude/features-booking-2a`; Josh still to test on an iPhone)**, and
   booking several cats at once (one visit per cat, one calendar event "Vet: Chester + Luna"). Before the photo feed.
9. [ ] **Desktop website layout** (big picture; Josh, 2026-11-10; size unknown, start with a UX brief): today a
   desktop browser gets the phone layout in a narrow column. Make the same app (https://paldex-4qh.pages.dev/)
   comfortable on a laptop or desktop screen.
   Brief: `docs/plans/2026-11-11-desktop-layout.md`. Josh (2026-11-11): friends use it too; side nav; no keyboard
   shortcuts (skip step 7); bigger cat on desktop (step 4, with an art check); no printable vet summary (drop the
   print part of step 6). **Steps 1 (breakpoints + side nav), 2 (sheets as dialogs / side panel), 3 (hover, focus
   rings, cursor), 4 (Home in two columns + the 160 px cat; the art session should still look at the 160 px scene)
   and 8 (centred screens) merged.** Step 5 (Health in two columns, the log as a table, drag-and-drop documents) is
   built on `claude/features-desktop-health` (pull request #17). Step 6 (All documents in two panes with a preview) and
   §4's tooltips on icon-only buttons are built on `claude/features-desktop-docs` (pull request, stacked on #17):
   at 1100 px and up All documents lists on the left and shows the selected document on the right (title, date ·
   visit · type, the reader's summary, the PDF in an `<iframe>` or the photo as an `<img>` from the short-lived
   `store.docUrl` link, "Open in new tab" and "…"); signed out it says documents need you signed in. Phones and tablets
   keep the tap-to-open list. Tooltips: `src/ui/Tooltip.tsx` (`<TooltipHost />` in App) shows an `.iconbtn`'s
   aria-label (up to its colon) or `data-tip` after 500 ms, mouse only, on devices that can hover. Not done: the Visit
   page's two-pane layout (the brief pairs it with All documents). Next: step 7 (wider grids). Idea for
   later: on desktop, the page column could slide left while the side panel is open (now the panel covers the right
   part of a centred page at 1280–1440 px).
- [x] **QA follow-ups to 3 and 7** (2026-11-10, pull request from `claude/features-followups`; no SQL):
   "Not from a visit" now unlinks a document linked the old way (`vet.doc`): it saves `visitId: 'none'`
   (`NO_VISIT`, `docVisitId` in `src/engine/docs.ts`; doses and weights read from it stay with the visit). Visit
   times are 12-hour everywhere (`fmtTime` in `src/engine/vets.ts`: visit page, vet cards, the Summary and its shared
   text). A booked visit whose day passed without being marked done shows in the Summary's recent visits as "booked,
   not marked done". Back on the visit page and All documents uses `back(fallback)` from `src/ui/router.ts`, which
   counts in-app pages in `history.state` (opened straight from a link, Back goes to Health instead of leaving the
   app; SkillPage, Together and the friend Visit page now use it too, since the audit fixes). Tunnel: Hide and
   seek is found only by tapping the bump while he hides; Ambush! is now tapping him as he peeks out of an end.
- [x] **Audit fixes** (2026-11-10, pull request from `claude/features-audit-fixes`; no SQL). Quick log
   (`src/ui/DailyTaps.tsx`): the Undo toast remembers which cat it logged for (`undo.catId`), names it when there's
   more than one cat ("Chester: Fed"), and "<other cat> too" means the cats other than that one, even after switching
   (test: `src/ui/dailytaps.test.tsx`). The toast is hidden while "What's off?" is open; Save brings it back and Undo
   then takes back the check and the symptoms together. A "something was off" check with no symptom logged today
   shows "What was it?", which reopens the picker. Health's Coming up shows visit times as 2:30 PM, and an overdue
   (or due) yearly checkup booked more than 30 days out still lists the booking, so Coming up isn't empty
   (`reminders()` in `src/engine/care.ts`). Back on the vet Summary is `back('health')`; deleting a visit goes back
   (or, opened from a link, replaces it with Health: `back(fallback, { replace: true })`), so the browser's Back
   doesn't reopen "This visit was deleted". A passed booking's visit page asks once ("How did X's visit go?"); the
   Booked chip is teal with dark text in dark mode.
- For Josh alongside: try a friend request between two phones; check the per-browser Add to Home Screen steps on a
  real iPhone and Android phone.

### Done recently
- [x] **Fix a mistaken quick log after the Undo is gone** (Josh: "accidental feeding and missing the undo makes it
  permanent"): see section 1, Quick log. Pull request from `claude/features-edit-logs`.
- [x] **Friends: strip on Home, visiting, free treats** (see section 1, Friends). SQL run.
- [x] **Treats for logging care** (see section 1, corner).
- [x] **Cat art redraw** (art session's notes, kept as written): first pass done and live (branch `claude/chester-cat-art-redraw-xlu1vr`, merged 2026-11-08).
   Dev `#/gallery` shows every pose and the nuzzle. Done, to the style guide:
   - One thin outline everywhere (`LW = 3` in `art.ts`; scaled heads draw thicker lines so it stays even), flat fills
     with one shadow shape, no gloss. Simpler face: round amber eyes with one highlight, tiny nose, small "w" mouth,
     two whiskers a side, faint blush.
   - **Sit:** smaller head (`SIT_HEAD`), pear body with haunches, front paws together, **tail wrapped round the paws**
     (a rig tail with low sway; the tip still flicks).
   - **Doze** (new pose `doze`): the sit with the head bowed and eyes as curves. Home uses it after 90 s alone
     (night still uses the curled `sleep`).
   - **Sleep:** one oval, head resting on the front paws, tail round the front.
   - **Drape** (new pose `drape`): lying along a cushion, chin over the edge, one front leg dangling, tail hanging.
     Home alternates it with kneading as the idle (14 s).
   - **Nuzzle** (anims `nuzzle`/`nuzzleL` in `chester.css`): on Home the cat and the one beside him lean cheek to
     cheek, eyes closed, purring, instead of the head bonk.
   - **Walk:** tail up like a question mark, face turned toward where he's going (`turn` option on `head()`).
   - **Ball (play)**, redrawn after Josh found the first version "terrifying" (four stick limbs reaching over the yarn):
     now on his back hugging the yarn to his chest with both front paws, chubby back feet against it showing toe
     beans, tail curled out in an S, a little blep. From Josh's references (qualities only: cat on its back with a
     yarn ball, paws round it).
   - Loaf, knead and fly restyled with smaller heads and the thin line. Outfits checked on every pose.
   - Not done: Josh's reference images weren't attached this session, so it was drawn from the style guide's notes.
     Ideas for a next pass: a true side-profile head for walk, the drape on the real Home card edge instead of its
     own cushion, a mirrored second cat in the nuzzle that shares one SVG so cheeks overlap exactly.
   Josh may also hire an artist; brief: SVG, named parts,
   flat colour regions, same canvas and ground line per pose, original art with full rights.

### Make logging effortless (Josh, 2026-11-08: "if it's tedious no one will do it")
- [x] **Home clean-up**: one friends card (the old card's + invite merged into `FriendsStrip`); Quick log first.
  Still open: move the Training and corner cards below the fold if Home feels long.
- [x] **One-tap buttons on Home** (done 2026-11-08, `DailyTaps`): **Fed**, **Scooped**, **Played**, each a single tap that logs "now, by me" with a
  quiet Undo toast instead of a form; long-press (or a small "…") for details. Most-used first.
- [x] **Meals: who fed them and when** (done; meals a day is set in each cat's Edit sheet): a "Fed" tap shows "Fed 2 of 2 today · last at 7:40 by Megan", so nobody
  double-feeds. Meals per day set per cat (default 2). Shared with the household like care.
- [x] **Litter box log** (done; after Scooped, "Looked off?" logs a Litter box change symptom): "Scooped" with an optional "something looked off" chip (vets ask about this first).
- [x] **Daily two-tap health check** (done): "Ate normally? Litter normal? Acting normal?" with all-yes as one tap; any
  "no" opens the symptom picker. Builds a baseline ("not eating since Tuesday"), earns care treats, feeds the recap
  and vet summary.
- [x] **Smart defaults** (done 2026-11-09; helpers in `care.ts`: `entryTime`, `lastOf`, `recentMeds`, `nextDueLike`):
  entries for today get the time now (they used to all be stamped noon; other days still get noon, and an edit keeps
  its time if its day stays); weight shows the last weigh-in as the placeholder plus "Last time: 6.2 lb on Nov 1";
  medicine has "Same as last time" chips (up to 3 recent names) that fill name, kind and notes and set next due with
  last time's gap; vet fills the last clinic; grooming starts on what you did last. Not done: a food on "Fed" taps.
- [x] **Home Screen shortcuts** (done; Android only, see section 1): manifest `shortcuts` (long-press the app icon: "Fed Chester", "Weigh-in") and
  deep links like `#/log/fed`, which iPhone Shortcuts can open (even from an NFC sticker on the food bin).
- [x] **Log for several cats at once** (done 2026-11-09): Fed, Scooped and Played still log the shown cat in one tap;
  with more cats the toast offers "Luna too" (or "All cats"), and Undo takes back all of them. `saveCare(..., { catId })`
  logs for another of my pets (no care treats for it: the corner reward is the shown pet's); sync now also pushes
  waiting care for my other pets, not only the shown one.

### Play (virtual and real)
- [ ] **Playable toys** (agenda 2 and 3; M each) *(art)*: today tapping a bought toy in the corner (`playWith` in
  `Corner.tsx`) only plays a canned reaction (`TOY_MOVE`) and `store.play()` gives the daily bond and treats. Make each
  one a real game:
  - **Laser dot** (bought): drag a red dot; the cat's eyes track it, he crouches and wiggles, then pounces; catches
    sometimes, misses sometimes.
  - **Wand** (new, free starter toy): flick a feather on a string; he leaps and bats at it.
  - **Box** (bought): he hops in and peeks out; tap the box and he pops up or swats.
  - **Tunnel** (bought): he zooms in one end and out the other, sometimes hides in the middle.
  - Keep the first-play-of-the-day reward (`PLAY_REWARD`); add "found a new move!" moments per toy.
  - **Part 1 done (2026-11-09):** `#/play/laser` and `#/play/wand` (`src/screens/Play.tsx`), opened from the corner's
    Play shelf (the wand is free for everyone; a gifted "a feather wand" is the same toy). His brain is pure and tested
    (`src/engine/play.ts`, `step()`): a fast dot is watched (eyes track it), a slow one walked to, then a crouch and
    butt wiggle (new looping rig move `stalk`) and a pounce (the rig's `hop` plus a sideways arc); a catch when the dot
    is under his paw on landing, else a miss; a dot up the wall is stared and chattered at. The feather swings on a
    spring under your finger; low and close he swats (the CSS `bat` paw) and sometimes bites it, swishing past or just
    above he leaps (mid-air catch at the apex). Five moves per toy (`PLAY_MOVES`), each logged once per pet as corner
    event `move-<toy>-<move>` (+3 treats, synced like the rest); the first catch of the day pays `PLAY_REWARD`
    (`store.play`). `Chester` takes `move`/`moveKey` to drive rig moves from outside; `Rig.halt()` stops a loop.
    `Wallet.playMoves` stays unused (the corner log is the shared record). **Revised 2026-11-09 (Josh: "it just looks
    like a sprite hopping")**: real side-on play poses (`crouch`, `leap`, `reach`, plus `run`), he sprints after a
    moving dot (`chase`, any speed over 1.5 cat-widths a second; stalks and pounces only once it's nearly still), a
    sixth laser move "Zoomies" (1.5 s of dashing), and toy speed measured over the time since it last moved (touch
    moves don't come every frame). Ideas: a side-on crouch/pounce pose (he
    pounces in his front-facing sit pose for now), paw-over-the-dot on a catch, a "laser frustration" fix (end on a
    catchable toy).
  - **Part 2 done (2026-11-10):** `#/play/box` and `#/play/tunnel` (`src/screens/Hideout.tsx`; brain
    `src/engine/hideout.ts`, `stepHide()`, pure and tested in `hideout.test.ts`), opened from the corner once bought.
    **Box:** he hops in (the `leap` pose over the rim) and sits; then ducks down to his ear tips, peeks with his eyes
    over the rim, pops up when you tap the box ("BOO!", the box jolts), sticks a paw out (`reach`) at a finger held
    beside it while he peeks, and springs out at a finger that waits there while he's ducked (lands on it, or misses
    if you pull away), then hops back in. Moves: If I fits I sits, Peekaboo, Boo!, Paw out, Box ambush.
    **Tunnel:** a tap sends him zooming through (`run` pose behind the tunnel, a small bump travels with him, a
    synthesized crinkle, `audio.crinkle()`); 35% of runs he stops to hide (a big rustling bump), then peeks his head
    out of the nearer end and comes out; a finger by an end while he hides gets a paw poke, a tap on the bump finds him
    (Hide and seek) and a tap on him while he peeks out ambushes (Ambush!), both make him burst out with a leap; he also goes through on his own every few seconds. Moves: Zoom through, Hide and seek,
    Peekaboo, Paw poke, Ambush!, Laps (3 runs through within 10 s). Same rewards as part 1 (+3 treats per move found,
    `move-box-…`/`move-tunnel-…`; the first "catch" of the day pays `PLAY_REWARD`). The shared header, speech bubble,
    rewards and moves card moved to `src/screens/PlayShell.tsx` (`PlayShell`, `usePlayTalk`). No new poses: drawn
    with the existing sit/crouch/leap/reach/run, sunk behind the box front (`SINK` per mode) and clipped at the floor.
    Not checked on a real iPhone. Ideas: a lying-in-the-box pose, a tail sticking out of the tunnel while he hides.
  - New poses (crouch, wiggle, pounce, chase, in-the-box) belong in `src/chester/*`, the art session's files: build it
    there, or with that session paused.
- [ ] **Log real play** (S): "Played 10 min" one tap (with the toy used); counts toward a gentle daily play goal
  (indoor cats need it), never a guilt message.

- [x] **Add vet visits to the calendar** (done 2026-11-09): a vet visit can be dated in the future (an upcoming
  appointment, with an optional time); its form then offers **iPhone / Apple** (an `.ics` file) or **Google** (a link),
  with a reminder the day before (`src/lib/calendar.ts`). Future visits don't earn the vet-visit treat bonus. Not
  checked on a real iPhone yet: whether the installed app opens the .ics in Calendar (Safari does). "Coming up" items
  (medicine due dates, grooming, the yearly checkup) also have a calendar button (all-day, .ics).

### Health ideas (from the 2026-11-08 review)
- [x] **Kitten growth guide** (done 2026-11-09): under the weight chart on Health, "Typical at about 7 months: roughly
  5–10 lb. A rough guide only; ask your vet." (`typicalKittenWeight()` in `care.ts`: about a pound a month to 6
  months, 5–10 lb from 7 to 11, nothing for adults). A band drawn on the chart needs a dated x-axis first.
- [x] **Vaccine and checkup timeline** (done 2026-11-09): "Kitten vaccines and checkups" on Health for pets under 18
  months (`kittenPlan()` in `src/engine/kittenplan.ts`): core FVRCP series, rabies, FeLV, spay/neuter, one-year
  boosters, ticked off by matching logged doses by name (FVRCP/distemper, rabies, FeLV/leukemia) or `Cat.altered`; tap a
  row to log it. Worded as a guide; the vet sets the real schedule.
- [ ] **Water and appetite notes** (S): optional chips on the daily check.

### Treats and corner
- [x] **Treat balance on Home**: already there (the corner card says "N treats to spend"). Could move higher.

### Friends safety
- [x] **Accept friend requests** (done 2026-11-09, `20261114000000_friend_requests.sql`, run): "Accept
  Erin?" instead of instant friendship; remove a friend from their cat's Visit page (see section 1, Friends). Policy
  test: `supabase/tests/friend_requests_test.sql`. Ideas: block someone outright; a request expiry.

### Phase 2: Chester's world (finish first)
- [x] **Badges and trophy case** (done 2026-11-08): `#/trophies` (Train, More), `src/engine/badges.ts` derives a badge
  per skill from progress (no storage), shelves by branch, earned first with the date, the closest badge on top; the
  recap says a new badge is in the trophy case. Ideas: a badge pop-in on the recap, the trophy case on friends' Visit.
- [ ] **"Pet me?" moments** (M) *(art)*: up to 3 a day, 9 AM to 9 PM, Chester walks on and asks for pets; petting adds
  bond and makes rare moves likelier, ignoring him costs nothing (he curls up).
- [x] **Bond levels unlock outfits** (done 2026-11-08): Buddies a bell collar, Pals a bow tie, Best friends an ear
  flower, Partners in crime a party hat, Soulmates the crown, free (`BOND_LEVELS[].gift`, `owned(c, bond)`); the corner
  says which level gives what. Still open *(art)*: idle behaviours per level.
- [x] **Nap tokens** (done 2026-11-08): `streakInfo()` in `lib/stats.ts`: every 7 days trained earn a nap (keep up to
  2), and a missed day spends one instead of resetting the streak; Train shows "· 1 nap saved". Derived from sets, so
  it agrees on every phone (`Wallet.napTokens` stays unused).
- [ ] **Mastery-only corner items** (S): e.g. a cozy box from Carrier comfort.
- [ ] **Play moves found by petting** (S) *(art)*: a counter of moves discovered (`Wallet.playMoves`, unused).
- [ ] **Photo feed** (agenda 4; L, SQL): real photos of your cats and your friends' cats in one feed, newest first,
  with a paw reaction and a short caption. Also offered at each mastered skill (this replaces the old Photo album
  item).
  - SQL: a `pet_photos` table (cat, path, caption, by, created_at) and a **new** storage bucket readable by the pet's
    household and its friends; never the `pet-docs` bucket (vet documents stay household-only). Reactions table.
  - Shrink on the phone before upload (e.g. 1600 px long side, JPEG ~0.8) to stay inside Supabase's free storage.
  - Safety: removing a friend hides your photos from them at once (policies check `friends`, not a copy); delete
    your own photos; "hide" for a friend's photo; think about report or block before it grows past close friends.
- [ ] **Push notifications** (L, SQL): new friend, a friend's treat, medicine due, "Pet me?". Web Push via a Supabase
  Edge Function with VAPID keys (environment secrets, never in the repo), a `push_subscriptions` table, triggers.
  iPhone only when installed. Today everything is in-app (red dot on Me, cards on Home).

### Phase 3: grow and open up
- [x] **Weekly recap** (done 2026-11-08): `#/week` (`src/screens/Week.tsx`, `weekSummary()` in `src/engine/week.ts`):
  the last 7 days of meals, scoops, play, daily checks, weight change, symptoms, vet and meds, sets and good-rep rate,
  who logged what, treats from friends and for care. Linked from the Quick log header ("Chester's week is in" on
  Sundays and Mondays). Ideas: what improved (steps up, mastered), share as an image.
- [ ] **Check-ins** (M): five quick questions every few weeks that unlock hidden skills (`wallet.checkinKeys`,
  `hiddenUnlocks` in `rules.ts`).
- [ ] **Glossary in the library** (S).
- [ ] **Backup import** (S): export exists, import doesn't.
- [ ] **App Store wrapper** (L): Capacitor, only if wanted; adds haptics.

### Health
- [x] **Vet summary** (done 2026-11-09): "Summary for the vet" on Health opens `#/vet-summary`
  (`src/screens/VetSummary.tsx`, `vetSummary()` in `src/engine/vetsummary.ts`): age, sex, spay/neuter, chip, weights,
  latest dose per medicine with next due, symptoms (60 days), daily checks (30 days), visits, current food.
  Since 2026-11-10: the vet header, tappable visits, the next visit, documents and Share (plain text). Idea: print as PDF.
- [ ] **Medicine reminders** (M): in-app now, notifications once push exists.
- [ ] **Suggest the "Loves it" treat for hard skills** (S).

### Friends
- [x] **Thank-you back** (done 2026-11-09; `20261113000000_treat_thanks.sql` run): the "Erin gave Chester a treat"
  line has **Say thanks** (`thankTreats` → `thank_treat`, household only); Erin's friends card then shows "Chester says
  thank you for the treat!" (`my_thanks()`, last 7 days; dismissed per phone). Before the SQL is run, Say thanks does
  nothing visible and no thank-yous show. Policy test: `supabase/tests/treat_thanks_test.sql` (after friend_treats_test).
- [ ] **A friend's cat visits your Home** (M) *(art)*: now and then sits beside yours for a bit.
- [x] **Friends in the weekly recap**: treats from friends are counted (names still to add).

### Treats
- [x] **7-day care streak bonus** (done 2026-11-09): care logged 7 days in a row: +10 treats and +1 bond, once per 7
  days (`careStreakDue()`, logged `streak-<day>`); a gap just restarts the count, never shown as broken.
- [x] **First play of the day gives treats** (done): +2 treats and +1 bond (`PLAY_REWARD`).

### Polish and housekeeping
- [x] **Add to Home Screen steps per browser** (done 2026-11-09): Safari, Chrome, Firefox, Edge, Samsung Internet and
  in-app browsers each get their own steps (see section 1, Getting it onto phones). Still to do: check each on a real phone.
- [ ] **A cleaner address** (S): `paldex-4qh.pages.dev` has a random suffix because `paldex` was taken; a second
  Cloudflare Pages project with a free name or a custom domain, then update `MOVED_TO`.
- [ ] **`chester.css` tidy-up** (M) *(art)*: 23 duplicated keyframe names across historical layers (later ones win);
  fold into one set with before/after screenshots.
- [ ] **Real recorded meows** (S): licensed recordings, if the synthesized ones sound robotic.
- [ ] **More outfits and toys** (S each): `SHOP` + `outfit()`.
- [ ] **Other animals** (L): dogs need their own art, skills and copy.

### For Josh (no code)
- [ ] Test a friend treat between two real phones.
- [ ] Try setup with a friend on a real iPhone: name and icon on the Home Screen, both cats in setup.
- [ ] Remove the duplicate Megan account (Me, People, the Megan with 0 sets, Remove from household) if it's still there.
- [ ] Optional: delete the leftover GitHub branch `claude/friends-care-treats` (a duplicate of `claude/friends-visit-treat`).

### The original phases (from the design doc, https://claude.ai/artifact/FX5FoXUmccY9j51Gzy14o9)
- **Phase 1, train with Chester:** done.
- **Phase 2, Chester's world:** corner, bond, wardrobe and toys done. Left: badges and trophy case,
  "Pet me?" moments (Chester walks on and asks for pets up to 3 times a day, 9 am to 9 pm; not built), photo album,
  notifications, and the corner leftovers (nap tokens, bond levels unlocking idle behaviours and outfits, mastery-only items such as a cozy box from Carrier comfort).
- **Phase 3, grow and open up:** accounts and sync done (households, friends), library done, backup export done.
  Left: check-ins and hidden skills, weekly recap, a glossary in the library, backup import, an App
  Store wrapper (Capacitor) if wanted.
- The design says each phase starts once the one before feels right in daily use, so finish Phase 2 first.
  The checklist above is grouped the same way.

---

## 3. File structure

```
src/
  main.tsx              entry: theme, self-updates, React root
  App.tsx               hash router: tabs #/home, #/health (#/health/log/<kind>), #/train, #/me; under Train #/tree,
                        #/library, #/skill/<id>, #/corner, #/trophies; #/week, #/vet-summary, #/health/visit/<id> (a vet visit), #/health/docs (all documents), #/visit/<cat>, #/log/<what>; #/session/<skill>, #/recap/<skill>, #/friends(/<code>),
                        #/together, #/join, #/add-pet, #/another (end of setup), dev-only #/gallery. Old #/care and
                        #/settings still work.
  engine/               pure logic, unit-tested, no I/O
    types.ts            Cat, SetRecord, SkillDef, Wallet, Gift, SessionDraft…
    skills.ts           the skill catalogue (text written for a boy named Chester; see lib/pet.ts)
    rules.ts            pass/step-up/mastery/struggle, hidden-skill unlocks
    corner.ts           Chester's corner: shop, log merge, balance, daily gift, bond levels
    rewards.ts          treats, daily caps, gift rolls
    derive.ts           progress and treats REPLAYED from sets (the shared source of truth)
    plan.ts             what to train next
    care.ts             care item types, reminders, red flags, newest-edit-wins merge
    vets.ts             your vet and emergency vet, Call/Directions links, booked vs done visits
    docs.ts             what belongs to a visit (docs, doses, weight), document search and filters
    vetsummary.ts       the summary for the vet, and its plain text for Share
    day.ts              local-day helpers (daily limits use the local date, never UTC)
  db/
    db.ts               Dexie (IndexedDB) tables: cats, sets, wallet, drafts, care, (legacy) progress
    store.ts            the app's one store: load, log sets, care, docs, pets, households, sync
  sync/
    remote.ts           the Remote interface the store talks to
    supabase.ts         Supabase implementation (+ fallback to per-pet sharing if the households SQL isn't run)
    fake.ts             in-memory server with the same rules, for tests
    config.ts           Supabase URL + publishable key
  chester/              the character
    art.ts              SVG poses: sit, doze, walk, ball, sleep, drape, loaf, knead, fly; shared head; chain tail
    rig.ts              spring rig + keyframed MOVES (hop, pounce, dance, bat)
    Chester.tsx         the component: petting, taps, reactions, rainbow dash trigger
    reactions.ts        tap reactions and which ones are allowed lying down
    RainbowDash.tsx     the dash overlay
    chester.css         CSS moves (several historical layers; later rules win; see section 6)
    spring.ts           damped spring
  screens/              Home, Train, QuickLog, Session, Recap, Tree, Library, SkillPage, Settings (Me), Care (Health),
                        Corner, Friends, Visit (a friend's cat), VisitPage (a vet visit), Documents, VetSummary, Install, Onboarding,
                        Together (account and invite forms), Scanner (barcode), YarnBall, Gallery (dev only)
  lib/
    audio.ts            sampled and synthesized sounds, jingle, litter, meow
    docparse.ts         rules that read vet/adoption/ESA paperwork
    ocr.ts              text from photos (Tesseract) and PDFs (pdf.js), loaded on demand
    petfood.ts          Open Pet Food Facts lookups
    pet.ts              petText(): pet's name and she/her for girls, applied to written copy
    appname.ts, appicon.ts  the app named after the cats, and its Home Screen icon drawn from them
    install.ts, invite.ts, moved.ts  install prompt/guide, friend invite links, the old address's redirect
    theme.ts            light/dark/system
    updates.ts          service-worker update-in-place
    images.ts, stats.ts, install.ts
  ui/                   TabBar (bottom bar / rail / side nav), layout (useLayout breakpoints), icons, router, PetSwitcher, FriendsStrip (friends' cats on Home)
  styles/app.css        tokens (light + dark), layout, components
supabase/
  migrations/           SQL, run by hand in the Supabase SQL editor, in this order:
    20261107230000_shared_training.sql   cats, cat_members, sets, RLS, join_cat
    20261108120000_care.sql              care table
    20261108180000_vet_docs.sql          pet-docs storage bucket + policies, 'doc' care kind
    20261108230000_household_tools.sql   cat_people, member removal (superseded by households, harmless)
    20261109000000_households.sql        households, migration of existing sharing, join_household, household_people
    20261110000000_friends.sql           friend codes, friendships, pet cards, add_friend/friend_pets/set_pet_card
    20261111000000_friend_treats.sql     friends' free treats: friend_treats, give_treat/treats_given/treats_for
    20261112000000_daily_logs.sql        adds the 'daily' care kind (one-tap Fed/Scooped/Played, daily check)
    20261113000000_treat_thanks.sql      thank-yous for friends' treats: thanked_at, thank_treat, my_thanks
    20261114000000_friend_requests.sql   friend requests: friend_requests, request_friend, answer/cancel, add_friend now asks
    20261115000000_vets.sql              your vet: the household's vet contacts (vets), household-only RLS
  tests/                plain-Postgres tests of the policies (stub_auth.sql/stub_storage.sql stand in for Supabase)
  functions/read-vet-doc/  OPTIONAL Claude-based document reader (Edge Function). Not used by the app (see decisions).
scripts/copy-ocr.mjs    copies Tesseract worker/engine/English data into public/ocr before dev/build (gitignored)
public/                 icons, sfx samples
docs/
  HANDOFF.md            this file
  sharing-setup.md      step-by-step Supabase setup (all SQL steps)
  next-steps.md         short running list (points here)
  plans/                the original Phase 1 plan
.agents/skills, .claude/skills   installed agent skills (reanimate, earshot, huashu-art-motion, claudedesignskills…)
```

---

## 3a. How the cat is drawn and animated (read before touching `src/chester`)

Written 2026-11-09 so nobody has to reverse-engineer it again. Keep it current when the mechanics change.

**Five layers, top to bottom.** A screen puts a `<Chester>` on the page; `Chester.tsx` turns props into an SVG string
from `art.ts` and runs two animation systems on it: **CSS classes** (`chester.css`) for idles, reactions and named
anims, and the **spring rig** (`rig.ts`) for physical follow-through and keyframed moves. Bigger scenes (the chase,
the rainbow dash, the play screen) move whole `<Chester>`s around with their own transforms.

### 1. The drawing: `art.ts`
- `chesterSVG({ pose, coat, eyes, mood, raised, anim, wear, width, uid, label, extra })` returns an SVG **string**.
  `Chester` memoizes it and injects it with `dangerouslySetInnerHTML`, so **changing `pose`, `anim`, `mood`, `wear`,
  `coat` or `width` rebuilds the SVG** (and the rig on it). Cheap, but don't flip those props every frame.
- **Canvas:** `viewBox="-14 -34 232 232"`, `overflow: visible`. The **feet/ground line is y = 188**; the body's middle
  is about x = 100. At a drawn width `W` px, one unit is `W / 232` px, the feet sit `0.957 W` below the SVG's top and
  the middle is about `0.49 W` from its left (the play screen and chase rely on this to stand him on a floor).
- **Poses** (`Pose`): `sit` (the default, the only one with the full rig), `doze`, `walk` (side view, faces **right**;
  flip with `scaleX(-1)` on a wrapper), `ball` (on his back with yarn), `sleep`, `drape`, `loaf`, `knead`, `fly`
  (rainbow dash), `run` (side on, faces right; the zoomies sprint), `curl` (tucked ball for the zoomies backflip; no
  shadow, spun as a whole about (100, 122)), `full` (front-facing, round belly after a meal: `.pawPat`, `.puff`),
  `sploot` (front-on, flat on the floor, legs out, tail up: the roll), and the **play poses**, side on facing right:
  `crouch` (stalk: shoulders low, `.rump` up and wiggling, `.pawLift`), `leap` (stretched pounce, front paws forward;
  the play screen tilts it along the arc), `reach` (rearing up on the back legs, `.swipe` paw high, mouth open). Each is a function in `art.ts` sharing `head()`, `limb()`, the coat (`COATS`) and `outfit()`.
- **Head:** `head(c, eyes, mood, uid, wear, { size, outer, turn })`, scaled by `HEAD_SIZE.scale` (0.88) × the pose's
  own size about the neck. `turn` swings the face toward the side (walk). `mood`: `curious` (round eyes), `happy`
  (^ ^), `sleepy`, `open` (mouth open).
- **Named groups** the animations hook into (keep these names when redrawing):
  - CSS targets: `.all` (whole body), `.head`, `.earL/.earR`, `.eyes`, `.lids` (blinks), `.look` > `.pupils` (eye
    direction), `.mopen/.mclosed`, `.tongue`, `.whisk`, `.blush`, `.pawL/.pawR` (`.pawR.raised` for the wave),
    `.legFL/.legFR/.legBL/.legBR` (walk), `.bodyg`, `.flytail`, `.tailbase/.tailtip`, `.wear .wear-<id>` (outfits),
    `.pillow`, `.dentL/.dentR` (knead), `.yarn`, `.zz`, `.snot`.
  - Rig targets (outer wrapper groups, so CSS and the rig never fight over one `transform`): `.r-all`, `.r-head`,
    `.r-earL/.r-earR`, `.r-legL/.r-legR`, `.r-shadow`, and the tail `.rtail` with two paths `.rt-o` (outline) and
    `.rt-f` (fill). `.rtail` carries `data-tail` (its rest curve as JSON) and `data-amp` (how lively; a nap ≈ 0.2).
  - The root `<svg>` gets classes `kc pose-<pose> <anim>`; the rig adds `rigged`.
- **Eye direction:** `.tapme .look { transform: translate(var(--lx), var(--ly)) }`. Set `--lx`/`--ly` (about ±3 px /
  ±2.4 px) on any ancestor and the pupils look that way: interactive Chesters do it toward your finger; the play
  screen does it toward the toy every frame.

### 2. CSS animation: `chester.css`
- Classes go in two places: the **`anim` prop** puts a class on the `<svg>` (`dance`, `wave`, `bat`, `nuzzle`); the
  **wrapper** (`.tapme`, the element around the SVG) gets the current reaction id (`r1`…`r15`), an idle (`i1`…`i5`),
  `notice`, `stroking` or `gone` (during the rainbow dash).
- **The file has historical layers** (sections marked `/* ---- … */` and `/* ==== … */`: idle life, named moves, tap
  reactions, pose-specific life, "fluid reactions v2", the sleep set, dance, pounce, the "v3 timing pass" matched to
  Josh's reference GIFs, kneading v4, stroke to pet, rig overrides at the end). **Later rules win**, and several
  keyframe names are defined more than once. When a move looks wrong, search for **every** rule on that selector.
- **CSS animations override SVG `transform` attributes** on the same element; that's why the rig writes to the outer
  `.r-*` groups. Moves the rig performs (hop, pounce, dance, bat body) are switched off in CSS on a `.rigged` cat.
- `.paused` on an ancestor freezes the CSS paw and the rig's move (training session pause).
- **Newest layer (2026-11-09, at the end of the file):** the walk retimed to Josh's reference (`cWalkLeg` 0.8 s stride,
  diagonal pairs ±18°, `cWalkBob`/`cWalkHead` 0.4 s so the body rises twice a stride and the head stays level); the
  **run gallop** (`cRunF` front pair, `cRunB` back pair, the far leg of each 35 ms behind, `cRunBody` stretch → gather →
  push with the flight phase at 75%, 0.4 s a stride; hips at (156|142, 132) front and (84|68, 132) back); the **full**
  pose (`cPat` belly pat 1.3 s, `cFullBreath`, `cPuff` every 3.4 s); the **roll** (`cRoll` 2.3 s on `.pose-sploot
  .all` under `.tapme.r7`: splat, tip over sideways about (100, 166), upside down at 46% (lifted and squashed so he
  stays on the floor), round to 360°, bounce; the old r7 back-roll rules are switched off for this pose); the play
  poses (`cWiggle` rump 0.5 s, `cPawLift`, `cSwipe` 0.42 s alternate, `cReachBob`).

### 3. The spring rig: `rig.ts`
- `new Rig(svg)` (made by `Chester` whenever the SVG is rebuilt, if it has `.rtail` or `.r-all`) runs one
  `requestAnimationFrame` loop (paused when off screen or the tab is hidden) and writes transforms every frame:
  - **Follow-through:** body lean from the hips (a `skewX` that keeps the feet on y = 188), squash, head lag, ears that
    lag the head and react to vertical speed, a 9-joint **tail chain** (each joint follows the one before; a sway at the
    base, a random tip flick every 4–10 s; clamped ±14°), breathing, and a shadow that shrinks and fades as he lifts.
  - **Petting:** `rig.stroke = -1..1` while a finger drags across him (set by `Chester`): he leans into it, ears relax.
  - **Keyframed moves:** `MOVES` = `hop` (950 ms), `pounce` (1.7 s, stalk + wiggle + leap + land + pad back), `bat`
    (3 s loop, yarn batting), `stalk` (700 ms loop, crouched butt wiggle; added for the play screen), `dance` (1.1 s
    loop). Keys have `t` (0..1) and channels `x, y, sx, sy, lean, head, hy, legL, legR` (units = SVG units; `legL/R`
    0..1 tucks a leg); missing channels hold, each eases between the keys that set it (`sampleMove`), then stiff
    springs add overshoot. `play(name)` starts one, `halt()` stops a loop, `kick('hop'|'bonk'|'shake'|'spin'|'flick',
    delayMs)` jolts ears and tail.
  - **Only sitting cats lean and do moves.** Any pose other than `sit` (`pose-sit` class absent) counts as "lying": it
    breathes and the tail moves, but `play()` does nothing.
- To **add a move**: add keys to `MOVES`, then trigger it with `Chester`'s `move` prop (below) or map a reaction to it
  in `RIG_MOVES`. Test timings in `#/gallery` and with Playwright frames (see section 7).

### 4. The component: `Chester.tsx`
- Props: `pose, coat, eyes, mood, raised, anim, width, wear, extra, label` (the drawing); `interactive` (tappable,
  pettable, eyes follow taps, idles every 5.2 s cycling `i1…i5`); `onPet(line, id)` (what he "says"); `react` +
  `reactKey` (play a reaction from outside, e.g. a good rep: change `reactKey` to replay the same one); `move` +
  `moveKey` (drive a rig move from outside: `'hop' | 'pounce' | 'stalk' | 'bat' | null`; null stops a loop; a new SVG's
  rig picks up the move that's on).
- **A reaction** (`reactions.ts`: id, weight, lines, sound, ms) = a CSS class on the wrapper for `ms`, plus either a
  rig move (`RIG_MOVES`: r1/r6/r11 hop, r14 pounce) or a rig kick (`KICKS`, with the delay that lines up with the CSS).
  Taps pick a weighted random one that never repeats; lying down only `LYING_OK` ones. `r14` (pounce) is session-only.
- **Rainbow dash:** 8 taps in 3 s (at most every 10 s) → `RainbowDash.tsx` overlay; the cat gets `gone` meanwhile.
- **Zoomies** (reaction `r5`, from a tap or `react="r5"`, e.g. the crinkle tunnel): `play('r5')` measures the drawn SVG
  and opens `Zoomies.tsx`, a portal overlay (like the dash) with a `run` and a `curl` SVG at 0.9× his width; a rAF
  timeline moves it: sprint off the right edge (0–650 ms, ease-in), gone, back in from the left (850–1500), leap into a
  tucked backflip (1500–2150: `curl`, arc up ~0.95 W, rotate −360°), land running and skid onto his spot
  (2150–2600), then the sitting cat reappears with a hop. The sitting cat has `gone` meanwhile. The old CSS
  `kzoomback` slide is no longer used for `r5`. Revised the same day: 3.1 s; the flip happens **mid-screen** (x = half
  the viewport), lift = min(1.4 W, his top − 60 px, 45% of the screen) so it stays on screen, 0.9 s with the ball
  growing ~25% mid-spin; then he runs back to his spot facing the right way (the run SVG flips).
- **Roll** (reaction `r7`, sitting only): `Chester` swaps its own pose to `sploot` (mood happy) for `ROLL_MS` (2.3 s)
  while the `r7` class plays `cRoll`, then goes back to the pose it was given.

### 5. Scenes that move cats around
- **Home's two sizes**: 104 px on phones and tablets, 160 px on desktop (`homeScene()`; offsets in the app.css "Desktop
  Home" block scale ×1.54). A new px offset in the Home scene needs its desktop twin there.
- **Home life** (`src/screens/Home.tsx`): `useHomeMood` picks the pose over time (sit; every 25–55 s either 7 s of
  `knead` or 14 s of `drape`, taking turns; `doze` after 90 s alone; `sleep` 10:30 PM–5 AM); `useHomeLife` runs the
  random meows and the litter-box gag; the nuzzle with the cat beside uses `anim="nuzzle"`. **Just fed:** a Fed tap
  in Quick log (`DailyTaps`) fires a `paldex:fed` window event with the cat ids (the shown one, or all after "Luna
  too"); Home shows those cats in the `full` pose for 9 s with "Mmm. So full." (not during the litter gag).
  **A bed:** if the shown cat has a cushion in use (`corner.cushion`), Home draws `CushionArt` (from `Corner.tsx`) under
  him in a `.bedspot` that doesn't move with the gag; idles are knead (its own pink pillow hidden by `.onbed`) or
  `loaf` instead of the sofa `drape`.
- **Chase** (`Chase.tsx`): timed phases (`AT`), each cat in a wrapper moved with a CSS `transform` transition and a
  `scaleX(-1)` wrapper to face left. Since the 2026-11-09 consistency pass it uses the play poses: `run` while chasing
  (run and bat phases), the lead cat `crouch`es (650 ms of wiggle) then springs in a `leap` (CSS `kchaseleap`, 0.5 s
  arc onto the ball, in `app.css`) and sits pleased; the others head-bonk (`r8`); everyone `walk`s home.
- **Litter gag**: walks off (`walk`), runs back (`run`, the `gagback` slide, flipped to face left).
- **Hiding toys** (`src/screens/Hideout.tsx` + `src/engine/hideout.ts`): same pattern as the play screen below.
  The cat sits in a floor-clipped layer between the toy's back and front SVGs (box: back wall and flaps behind, front
  panel in front; tunnel: all in front while he's in it); `inside()` decides the z-order and `SINK` how far he drops
  into the box. The tunnel outline is rebuilt each frame with a bump where he is. Dev: `globalThis.__hideBrain`.
- **Play screen** (`src/screens/Play.tsx` + `src/engine/play.ts`): a pure `step(brain, target, dt)` decides the mode
  each frame (sit, watch, stare, walk, stalk, pounce, land, swat, happy) and emits events; the screen writes the cat's
  `translate` and `--lx/--ly` straight to the DOM every frame and only re-renders React when the mode, facing or
  "in the air" changes. Poses per mode (side poses flip with `scaleX(-1)` by facing): `chase` → `run` (a sprint behind
  a moving dot at ~its speed), `walk` → `walk`, `stalk`/`land` → `crouch`, `pounce` → `crouch` at take-off and landing
  and in the air `leap` (laser, tilted −26°→+26° along the arc on an inner wrapper) or `reach` (wand: rearing jump with
  a paw up); `swat` → `reach`; `watch` → `crouch` (laser) or `sit` (wand); `stare`/`sit`/`happy` → `sit` (`react="r13"`
  on a catch). Mouth open (`mood="open"`) in the air and while swatting. Dev builds expose the brain as
  `globalThis.__playBrain` for checks.

### Checking an animation
- `#/gallery` (dev only) shows every pose and the nuzzle. The dev store is `globalThis.__chesterStore` for seeding.
- Playwright: screenshot frames or an element clip at intervals and tile them into a contact sheet (that's how the
  pounce, walk and play screen were checked). For CSS timings use `page.clock` to jump to just before a moment, then
  `clock.resume()` and capture in real time (CSS animations don't follow the fake clock).
- Unit tests: `rig.test.ts` (move sampling), `chester.test.ts` (reaction picking, every pose × coat renders with the
  parts the rig and CSS need), `engine/play.test.ts` (the play brain).

## 4. How to work on it

- **Start cloud sessions on the `chester-training` environment** (section 7): the Default one can't reach the food
  databases, the live site or Supabase.

```bash
npm ci
npm run dev        # copies OCR files, then Vite on :5173/chester-training/ ; #/gallery shows every pose
npm test           # vitest (jsdom + fake-indexeddb + the fake server)
npm run typecheck
npm run build      # what CI runs
```

- **Dev store handle:** in dev builds only, `globalThis.__chesterStore` is the store. Screenshots and scripts use it to
  seed pets (`saveCat`, `logSet`) or to set state.
- **Database policy tests:** start a throwaway Postgres 16, load `supabase/tests/stub_auth.sql` and
  `stub_storage.sql`, then the migrations in order, then `rls_test.sql`; run `care_test.sql`, `docs_test.sql` and
  `household_test.sql` each in their own `psql` session (the households migration goes before them). The households
  test removes members at the end, so run it last (it also needs user D from `people_test.sql`). `friends_test.sql`
  sets up its own people: run it right after the friends migration (stubs, all migrations, `rls_test` before households).
  `friend_treats_test.sql` also sets up its own people: run it after the friend treats migration (it's fine after
  `friends_test.sql`). The full order that passed on 2026-11-08: stub_auth, stub_storage, shared_training, care,
  vet_docs, household_tools, rls_test, households, friends, friends_test, friend_treats (twice, to check it's
  idempotent), friend_treats_test. On 2026-11-09 the whole chain passed again with daily_logs, treat_thanks,
  treat_thanks_test, friend_requests (twice) and `friend_requests_test.sql` (last: the earlier tests use instant
  `add_friend`).
- **Animation checks** were done with Playwright screenshots/frames (Chromium is preinstalled in cloud sessions).
- **Hosting:** GitHub Pages builds at `/chester-training/` (the default). Cloudflare Pages builds at the root with the
  environment variable `BASE_PATH=/`: build command `npm run build`, output folder `dist`, Node 22 (`.node-version`).
  Every push to `main` deploys both once Cloudflare is connected.
- **Supabase changes:** Josh runs SQL himself in the dashboard's SQL editor (cloud sessions can't reach supabase.com).
  Keep migrations idempotent (`if not exists`, `drop policy if exists`) and paste them into chat for him.

---

## 5. Decisions made (and why)

| Decision | Why |
|---|---|
| **Sets are the shared record; progress and treats are replayed from them** | Two phones can never disagree; sets are append-only, so syncing is just "send what they lack, take what I lack". |
| **Care items: newest edit wins, deletes are tombstones** | Care can be edited and deleted (sets can't); tombstones let a delete reach the other phone. |
| **Email + password, "Confirm email" off** | New free Supabase projects can't edit email templates without custom SMTP, and email links open Safari instead of the installed app. Passwords need no email at all. |
| **Households, not per-pet sharing** | Josh's call: people live with several pets; one invite should cover them all, and new pets should be shared automatically. Old per-pet codes still work and the old path stays as a fallback. |
| **Only the household creator removes people; anyone can leave** | Simple, predictable; a removed person's logged sets stay. |
| **Vet documents are read on the phone with rules, not AI** | Free, no API key, nothing sent anywhere to be read, and friends can't run up Josh's bill. Tuned on a real rescue/clinic packet. The Claude Edge Function stays in the repo as an option. |
| **Tesseract and pdf.js files are served by PalDex, loaded on demand, not precached** | Works on any connection, testable offline; keeps the app download small (the engine and English data are ~15 MB). |
| **Food lookup uses Open Pet Food Facts** | Free and open (ODbL, credited in the UI); scraping stores would break their terms. |
| **No recorded copyrighted audio; the dash tune is original** | Josh asked for a Nyan-style dash; the song and look are deliberately original (no pixel art, no pastry, no borrowed melody). |
| **Cats only for now** | The art, skills and copy are cat-specific; dogs are a separate project. |
| **Copy is written for "a boy named Chester" and adapted at render time** (`lib/pet.ts`) | One set of text; girls get she/her and every pet gets its own name. User-typed notes are never rewritten. |
| **Night is 10:30 PM to 5 AM; a tap wakes him** | 9 PM was too early for evening use. |
| **App name PalDex, URL unchanged** | Renaming the repo would break the URL and home-screen installs. If it ever goes public, reconsider the name: "Pokédex"/"Paldea" are Nintendo's. |
| **Self-updating PWA (`registerType: 'prompt'` + `updates.ts`)** | iPhone home-screen apps only check for updates on a cold start; this checks on return to the front and never interrupts a session. |
| **Remembered "my name" is per account** | It used to be per phone, which put Megan's name on Josh's account. |
| **New address on Cloudflare Pages (`*.pages.dev`)** | Josh's call: free, shorter, no GitHub name in it. The old link keeps working and points people to the new one; data comes along by signing in (local-only data stays on the old address). |
| **Corner lives on the pet record, as a log merged by id** | No new SQL for Josh to run, works offline, and two phones buying at once both keep their buys. Offline double-spending can push the balance below zero; it shows as 0 and buying waits until it's positive. |
| **Install page before setup, on phones only** | Josh's call. On iPhone, setting up in Safari and then installing would leave the data behind in Safari, so installing first is also the safe order. |
| **No reduced-motion override** | Josh's explicit choice in Phase 1. |
| **Care entries earn treats, capped at 3 a day** | Training was nearly the only way to earn treats, which doesn't fit a tracker-first app; the cap keeps self-reported logging from becoming a tap-to-win game (a design anti-goal). |

---

## 6. Gotchas

- **`chester.css` has several historical layers** (v1, v2, v3 moves, then the rig overrides). Later rules win. When a
  move looks wrong, search for every rule on that selector, including the old `kswat` and `yrock` that used to live in
  `app.css`. Moves the rig performs (hop, pounce, dance, bat) are switched off in CSS on a `.rigged` Chester.
- **CSS animations override SVG `transform` attributes.** The rig writes transforms onto wrapper groups (`.r-all`,
  `.r-head`, `.r-earL/R`, `.r-legL/R`, `.r-shadow`) so CSS and the rig can both run.
- **Don't delete Supabase users** to reset a password: their sets are deleted with them. Reset it in
  Authentication, then Users.
- **Pages served under `/chester-training/`:** use `import.meta.env.BASE_URL` for any asset path.
- **The households SQL is detected at runtime** (`SupabaseRemote.households()`); a "no" is rechecked after a minute.
- **Personal data:** Josh's real document packet contains his SSN digits, DOB, address and phones. It was only ever
  in a temporary folder; the test fixtures use made-up details. Keep it that way.
- **UI tests: wait for the work, not a fixed time.** After a tap that saves, `await store.settled()` (inside `act`):
  it resolves once every queued store write is done, including ones queued meanwhile (a care entry's treats), then
  lets React apply what follows. A fixed sleep (`setTimeout(r, 30)`) made `dailylog`, `dailytaps` and `booking` tests
  fail in about 1 in 5 full runs (fixed 2026-11-11): under load a save outlasts the sleep, the Quick log tile is still
  `disabled` while saving, and the next click is silently dropped. Also add `afterEach(cleanup)` in files that render
  (there are no vitest globals, so Testing Library doesn't clean up by itself); otherwise one failure leaves its screen
  mounted and fails every later test in the file with "Found multiple elements".
- **Supabase free tier:** projects pause after a week unused (Restore in the dashboard); the built-in mailer allows only
  ~2 emails an hour (not used now).

---

## 7. Skills, plugins and tools

Keep this section current: whenever a skill, plugin or MCP server is added, removed or used for real work, note it
here in the same commit (see `CLAUDE.md`).

### Installed in the repo (load in every session here; pinned in `skills-lock.json`)
| Skill(s) | Source | Added | Used for |
|---|---|---|---|
| `reanimate` | NiazMorshed2007/reanimate | 2026-11-07 | Matching Chester's timings to Josh's reference GIFs (knead, nod, chin scratch, back roll, play bite, pounce, dance, yarn batting) |
| `earshot`, `real-sound` | Leonxlnx/earshot | 2026-11-07 | Clicker and reward samples from its sound bank (`public/sfx`); listening to and balancing sounds |
| `huashu-art-motion` | alchaincyf/huashu-art-motion | 2026-11-07 | Motion style reference for the same pass (showcase GIFs left out to keep the repo small) |
| claudedesignskills (23 skills: `motion-framer`, `animejs`, `threejs-webgl`, `lottie-animations`, `react-spring-physics`, …) | freshtechbro/claudedesignskills | 2026-11-07 | Web animation and 3D reference. Its `gsap-scrolltrigger` was replaced by the official one (old copy still in `.agents/skills/`) |
| `gsap-core`, `gsap-timeline`, `gsap-react`, `gsap-plugins`, `gsap-utils`, `gsap-performance`, `gsap-frameworks`, `gsap-scrolltrigger` | greensock/gsap-skills (official) | 2026-11-08 | Installed, not used yet |
| `text-to-lottie` | diffusionstudio/lottie | 2026-11-08 | Installed, not used yet |
| `supabase` | supabase/agent-skills (official) | 2026-11-11 | Installed at Josh's request; for SQL, RLS and auth work. Not used yet. (`reddit-automation` from flowkit-labs/skills was added the same day for a Reddit search, which the network blocked, then removed at Josh's request.) |
| `supabase-postgres-best-practices` | supabase/agent-skills (official) | 2026-11-11 | Installed at Josh's request: Postgres rules for schema, migrations, RLS, indexes and queries (reference docs only, no scripts). Load before writing SQL (e.g. the photo feed). Not used yet. |
| `find-skills` | vercel-labs/skills | 2026-11-11 | Installed at Josh's request: finds skills with `npx skills find`. Its tip to install with `-g -y` is not followed here; ask Josh before installing anything it finds. Not used yet. |
| `remotion-render` | inference-sh/skills | 2026-11-11 | Installed at Josh's request for the UX auditor: renders Remotion (React) code to MP4 on inference.sh's cloud. Needs their `belt` CLI, an inference.sh account and key, and network access to inference.sh; none are set up, so it can't run yet. Its frontmatter pre-approves `belt` commands. It sends the code you render to a third party, so never put user data in it. Not used yet. |
| `ask-matt` | mattpocock/skills | 2026-11-11 | Installed at Josh's request: a menu (run only as `/ask-matt`) that points to Matt Pocock's other workflow skills (`/grill-with-docs`, `/to-spec`, `/tdd`, …). Those aren't installed, so it's only a guide for now. Not used yet. |

Files: the claudedesignskills, reanimate, earshot and huashu skills live in `.agents/skills/` with symlinks in
`.claude/skills/`; the GSAP and Lottie skills are copied straight into `.claude/skills/`.

### Cloud environment
- **`chester-training`** (personal, created 2026-11-08): package registries and MCP servers, plus
  `world.openpetfoodfacts.org`, `world.openfoodfacts.org`, `api.upcitemdb.com` (food lookups), `paldex-4qh.pages.dev`
  (to check the live site) and `vtcufhddooqzckjcpzwn.supabase.co` (to check the SQL was run, signed out, with the
  public key). The Default environment allows none of these. Added 2026-11-09 for Josh's animation references:
  `cdn.svgator.com`, `www.svgator.com`, `cdn.dribbble.com`, `images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com`, then
  `i.pinimg.com` (the roll GIF) and `static.vecteezy.com` (feather-toy pictures).
  The Default environment blocks those hosts. Start PalDex cloud sessions on this one.

### MCP servers (repo, `.mcp.json`)
- `lottiefiles-creator` (`npx -y @lottiefiles/creator-mcp@latest`), added 2026-11-08. Loads from the next session;
  Claude Code asks once before trusting it. Not used yet.

### From Josh's account (every project, not in the repo)
- The account-wide skills (artifact-design, systematic-debugging, writing-handoffs and the other anthropic-skills).
- Plugins: **Icons8** was offered (Anthropic Directory) but isn't turned on yet. If it is, it could replace
  `src/ui/icons.tsx` and the corner's toy art.

### Skills actually used so far
- 2026-11-11, desktop step 6, All documents preview + tooltips (Features worker): no skills, plugins or MCP servers
  invoked beyond the GitHub and session tools (`lottiefiles-creator` connected, unused). Checks: Vitest (243, new
  `src/screens/documents.test.tsx`), typecheck, build; Playwright against the Vite dev server with a cat and three
  documents seeded through `globalThis.__chesterStore` (its `docUrl` stubbed with a Pillow-made image), at 390, 900
  and 1440 px, light and dark, plus a hover over Back for the tooltip.
- 2026-11-11, desktop step 5, Health in two columns + the log table + drag-and-drop documents (Features worker): no
  skills, plugins or MCP servers invoked beyond the GitHub and session tools (`lottiefiles-creator` connected,
  unused). Checks: Vitest (236, new `src/screens/health.test.tsx`), typecheck, build; a jsdom dump of Health and All
  documents before and after the change (byte-identical at phone width); Playwright against the Vite dev servers of
  main (a git worktree) and the branch, a cat and a month of care seeded through `globalThis.__chesterStore`, at 390,
  900 and 1440 px, light and dark; Pillow pixel diff of Health at 390 and 900 px (identical); a synthetic `dragenter`
  with a PDF for the drop note.
- 2026-11-11, desktop step 4, Home in two columns + the 160 px cat (Features worker): no skills, plugins or MCP
  servers invoked beyond the GitHub and session tools. Checks: Vitest (new `src/screens/home.test.tsx`), typecheck,
  build; Playwright against the Vite dev servers of main and the branch (two cats seeded through
  `globalThis.__chesterStore`, `page.clock` fixed at 2 PM) at 390, 900 and 1440 px, light and dark; Pillow pixel diff of
  the 390 px Home, main vs branch (identical outside the animated cats); 160 px frame strips of the chase, the litter
  gag, the nuzzle and the bed (`page.clock.fastForward` to the timed moments, then real time); the Undo toast at 1440
  and 1920 px; the rainbow dash at 1440 px.
- 2026-11-11, desktop steps 3 and 8, hover, focus rings, centred screens (Features worker): no skills, plugins or
  MCP servers invoked beyond the GitHub and session tools (`lottiefiles-creator` connected, unused). Checks: Vitest
  (222), typecheck, build; Playwright against the Vite dev servers of main and the branch (`VITE_SUPABASE_URL=`, a cat
  seeded through `globalThis.__chesterStore`): iPhone 13 (hover:none) for Onboarding, Me, Week, Trophies, Library,
  light and dark, Pillow diff vs main; 900 and 1440 px light and dark for the same screens plus a Tab-key focus ring
  and a mouse hover on Me.
- 2026-11-11, QA of PR #13 (desktop step 2, sheets): no skills, plugins or MCP servers invoked beyond the GitHub and
  session tools. Checks: tests, typecheck, build; Playwright against the Vite dev servers of main and the branch (dev
  store seeded) at 390, 900 and 1440 px, light and dark: Tab trap (40 presses), Esc and focus return, backdrop
  click, saving (weight, Book a visit with a typed time, Edit pet), sticky Save, toasts on top after saving, no
  sideways scroll, page scroll behind a sheet (mouse wheel); Pillow pixel diff of four phone sheets, main vs branch
  (identical). Fix: the page behind no longer scrolls under a tablet/desktop sheet (it did on main too).
- 2026-11-11, desktop step 2, sheets as dialogs / side panel (Features worker): no skills, plugins or MCP servers
  invoked beyond the GitHub and session tools. Checks: Vitest, typecheck, build; Playwright against the Vite dev
  server (store seeded through `globalThis.__chesterStore`) at 390, 900 and 1440 px, light and dark: wrapper class
  per width, sticky Save position, Esc, 40 Tabs never leaving Book a visit, focus back on the opener, toast spots.
- 2026-11-11, desktop step 1, breakpoints + side nav (Features worker): no skills, plugins or MCP servers invoked
  beyond the GitHub and session tools. Checks: Vitest, typecheck, build; Playwright screenshots of two production
  builds (main and the branch) at 390, 900, 1280 and 1440 px, light and dark, with two cats written straight into
  IndexedDB; Pillow (`ImageChops.difference`) to compare the 390 px shots pixel by pixel (identical apart from the
  animated cat, which also differs between two runs of main).
- 2026-11-11, QA of PR #12 (desktop step 1): no skills, plugins or MCP servers invoked. Checks: tests, typecheck,
  build on the branch merged with main; Playwright (390/900/1280/1440 px, light and dark, dev store seeded with two
  cats) for tabs, active state, pet switching from the nav, Log, deep link + Back, live resizing, toast/note placement.
- 2026-11-10, booking polish (Features worker): no skills, plugins or MCP servers invoked. Checks: Vitest, and
  Playwright iPhone 13 screenshots (light and dark) from the Vite dev server, seeding data with
  `import('/chester-training/src/db/store.ts')` in the page and `navigator.standalone` stubbed for the icon note.
- 2026-11-11, booking part 2a, reschedule and cancel (Features worker, `claude/features-booking-2a`): no skills,
  plugins or MCP servers invoked beyond the GitHub MCP (pull request) and `send_message` to the PM (`lottiefiles-creator`
  connected, unused). Checks: Vitest (245 tests in 41 files), typecheck, build; Playwright iPhone 13 screenshots
  (light and dark) of a booked visit, Reschedule, "Move it in your calendar?" and a cancelled visit, seeded the same way.
- 2026-11-10, booking polish QA (QA worker): no skills, plugins or MCP servers invoked beyond the GitHub and
  session tools. Checks: Vitest, typecheck, build; Playwright (iPhone 15, light and dark, dev store
  `globalThis.__chesterStore`) for Book from Coming up, Call, quick times, Undo, Other clinic offline with Google, and
  the icon note (iPhone standalone, Safari tab, Android standalone).
- In the Nov 7 sessions: **reanimate**, **earshot**/**real-sound**, **huashu-art-motion** and claudedesignskills (motion
  and sound pass).
- In the Nov 8 redraw session: no skills invoked. The `lottiefiles-creator` MCP server connected (first time) but
  wasn't used. Checks were Playwright screenshots: a pose x coat sheet loaded straight from the Vite dev server
  (`import('/chester-training/src/chester/art.ts')` on a non-app page) and frame strips of hop, pounce, walk and the
  nuzzle from `#/gallery`.
- In the earlier Nov 8 session: none of the installed skills were invoked; the GSAP, Lottie and LottieFiles tools
  were installed but not used. Good candidates next: **reanimate** to match Josh's reference GIFs when redrawing and
  re-timing poses; **earshot** before any sound change; **text-to-lottie** or LottieFiles for one-off celebrations.
- Plugins: the Anthropic Directory's **Icons8** was offered (not enabled).

- In the friends visit + treat session (2026-11-08, `claude/friends-visit-treat`): no skills, plugins or MCP servers
  were invoked. Checks used Playwright (iPhone 15, light and dark, the dev store seeded with the in-memory
  `FakeServer` imported through Vite) and a local Postgres 16 for `friend_treats_test.sql`.

- In the friend requests session (2026-11-09, `claude/friend-request-acceptance-zytxm7`): no skills, plugins or MCP
  servers were invoked (`lottiefiles-creator` connected, unused; `sp-global` failed to connect, not needed). Checks:
  a local Postgres 16 for the SQL chain and `friend_requests_test.sql`, and Playwright (iPhone 15, light and dark)
  with the dev store on the in-memory `FakeServer` for Home's request card, Friends and Visit's Remove friend.

- 2026-11-09/10: the vet redesign. The UX auditor session wrote the plan (PR #2) with anthropic-skills:design-ux; this
  session built steps 1–2. Checks: a local Postgres 16 for `vets_test.sql`, unit and sync tests, one Playwright shot.
- Later: bed on Home, the flip moved mid-screen, the roll (sploot pose), play poses (crouch/leap/reach) and the laser
  sprint. No skills invoked; references split into timed contact sheets with Pillow; checks as Playwright frame strips
  (stepped CSS animations), a pose log during a scripted drag, and the Home bed via `page.clock` fast-forwarding.
- Later: zoomies sprint + backflip, run/curl/full poses, walk retimed. No skills invoked; the reference GIFs (walk,
  run, flip) were downloaded and split into timed contact sheets with Pillow (frame durations from the GIF), the
  poses checked as Playwright frame strips with CSS animations paused and stepped (`getAnimations()` →
  `currentTime`), and the zoomies as a real-time screenshot strip.
- Later: playable laser dot and wand (agenda 2). No skills invoked; Playwright frame strips of a scripted drag.
- Later: smart defaults and logging for all cats (agenda 1). No skills or MCP servers; Playwright on the dev store.
- 2026-11-10, Features worker, box and tunnel games (`claude/features-box-tunnel`): no skills, plugins or MCP servers
  invoked (`lottiefiles-creator` connected, unused). Checks: Playwright (iPhone 13 size, light and dark) with forced
  brain states via `__hideBrain` and scripted taps, tiled into contact sheets with Pillow.
- Later the same day: the per-browser install guide. No skills, plugins or MCP servers invoked; checked with
  Playwright (iPhone 15 size, user agents for iPhone Safari, Chrome, Instagram and Samsung Internet).
- 2026-11-10, vet redesign steps 3–5 (Features worker, `claude/features-vet-redesign-3-5`): no skills, plugins or MCP
  servers invoked. Checks: unit tests, a screen test on the real store with fake IndexedDB (`src/screens/visit.test.tsx`),
  and a few Playwright shots (iPhone 15, light) of the visit page, All documents, the summary and Health's documents,
  with the dev store seeded through `import('/chester-training/src/db/store.ts')`.
- 2026-11-10, QA follow-ups (Features worker, `claude/features-followups`): no skills, plugins or MCP servers invoked
  (`lottiefiles-creator` connected, unused). Checks: unit tests only (docs, vetsummary, vets, hideout, a new
  `src/ui/router.test.ts`); no screenshots.
- 2026-11-10, UX quick wins (Features worker, `claude/features-ux-quick-wins`): no skills, plugins or MCP servers
  invoked (`lottiefiles-creator` connected, unused). Checks: unit tests, and Playwright shots (iPhone 15, light and
  dark) of Home's Undo toast with two cats, the What's off? chips, and Health, the dev store seeded via
  `__chesterStore` with `VITE_SUPABASE_URL=`.
- 2026-11-10, QA of pull request #6 (QA worker): no skills, plugins or MCP servers invoked (`lottiefiles-creator`
  connected, unused). Checks: tests, typecheck, build; Playwright (iPhone 15, light and dark, `--safe-b` forced to 34px
  for the home indicator) of the toast with three cats, the chips and Health; `git merge-tree` against PR #5. Fixed:
  the What's off? picker now closes when the cat is switched, and Save can't log twice.
- 2026-11-10, audit fixes (Features worker, `claude/features-audit-fixes`): no skills, plugins or MCP servers
  invoked (`lottiefiles-creator` connected, unused). Checks: tests, typecheck, build; Playwright (iPhone 13, light and
  dark) of Home (picker, status line and toast with two cats), Health, and a passed and an upcoming booking, seeded by
  importing `/src/db/store.ts` from the Vite dev server in `page.evaluate`.

- 2026-11-10, vet booking fixes (Features worker, `claude/features-vet-booking-fixes`): no skills, plugins or MCP
  servers invoked (`lottiefiles-creator` connected, unused). Checks: tests (a new `src/ui/booking.test.tsx` with the
  calendar module mocked and `window.open` stubbed), typecheck, build; Playwright (iPhone 13, light and dark, dev
  server with `VITE_SUPABASE_URL=`, store seeded via `import('/chester-training/src/db/store.ts')`) typing the vet's
  name with real keystrokes, the calendar choice, the saved-vet card and "Add to which calendar?".
- 2026-11-10, QA of pull request #8 (QA worker): no skills, plugins or MCP servers invoked (`lottiefiles-creator`
  connected, unused). Checks: tests, typecheck, build; Playwright (iPhone 15, light and dark, dev store) for the vet
  name typed after focusing another field, Google link and .ics contents, booking with no vet, Cancel, double-tap Save.
  Fix: Google links now carry `ctz`.
- 2026-11-10, fix mistaken quick logs (Features worker, `claude/features-edit-logs`): no skills, plugins or MCP
  servers invoked (`lottiefiles-creator` connected, unused). Checks: tests (194 in 35 files; new
  `src/engine/dailylog.test.ts` and `src/ui/dailylog.test.tsx`), typecheck, build; Playwright (iPhone 15, light and
  dark, dev server with `VITE_SUPABASE_URL=`, two cats seeded through `globalThis.__chesterStore`) of Home's Quick log,
  the Fed sheet, its delete confirm, and Health's 7-day Quick logs sheet.
- 2026-11-10, QA of PR #10 (QA worker): merged `main` in (trivial import conflict in `DailyTaps.tsx`); no skills,
  plugins or MCP servers invoked. Checks: tests (204), typecheck, build; Playwright (iPhone 13, light and dark, dev
  store, two cats). Fixed: the sheet now replaces the Undo toast and closes on a cat switch (test added).

### The team (project manager and workers)
- Since 2026-11-10 work can go through a **project manager** session that starts short-lived **Features** and **QA**
  worker sessions (at most 2 at a time, only when Josh asks). Rules and roles: `docs/team.md`.

### Scheduled tasks
- **PalDex UX review** (set up 2026-11-08/09 by the friends session, at Josh's request): **once a night at 1:45 AM
  Eastern** (`CRON_TZ=America/New_York 45 1 * * *`; changed 2026-11-09 from every 4 hours, to save usage; it starts by
  checking for new commits, so a night with none is a short run)
  the scheduled task `trig_01AyfUBBkAdj5EHVj45Gb12g` wakes one long-lived session, **"PalDex UX reviewer"**
  (`session_019xqnwfdJXvj4DJJnDqRx1K`, repo attached, its steps in its system prompt). It checks main for new commits
  since the `last-reviewed:` line in `docs/ux-review-log.md`, screenshots the touched screens at iPhone size (light and
  dark), audits them with `anthropic-skills:design-ux` and the notes in that file, makes small visual fixes and opens
  (or adds to) one `claude/ux-review-...` pull request for Josh to merge. Never pushes to main; never touches
  `src/chester`, `src/sync`, `src/db`, `src/engine` or `supabase`. Why one long-lived session: scheduled tasks that start
  a fresh session can't attach a repo from a tool call (the first try, 2026-11-08, could read but not push or open a
  PR). To change what it reviews, edit "Notes from Josh" in `docs/ux-review-log.md`; pause it from the scheduled
  tasks list on claude.ai.

### Tools used for checks (no install needed)
- Playwright with the preinstalled Chromium for screenshots and animation frames (light and dark mode). For timed
  animations, fast-forward with `page.clock` to just before the moment, then `clock.resume()` and capture in real time:
  CSS animations don't follow the fake clock.
- Pillow (preinstalled Python) for pixel diffs between two screenshots, e.g. phone layout before and after a change.
- Chromium's fake camera (`--use-file-for-fake-video-capture` with a generated barcode video) to test the scanner.
- A throwaway local Postgres 16 (`/usr/lib/postgresql/16/bin`, run as the `postgres` user in a folder it can reach,
  e.g. `/var/tmp`) for the SQL policy tests.
- Flaky-test hunt (2026-11-11): loop the full suite, e.g. `for i in $(seq 1 20); do npx vitest run > run$i.log 2>&1 ||
  echo FAIL $i; done`, and run two suites at once for extra load. Only the first failure in a file matters (see Gotchas).
- iPhone emulation in Playwright (`devices['iPhone 15']`, `navigator.standalone` stubbed for "installed") for the
  install and setup flow; build with `VITE_SUPABASE_URL=` to test setup without touching the real database.

### Install commands used (to repeat in another project)
```bash
npx -y skills add diffusionstudio/lottie --agent claude-code
npx -y skills add https://github.com/greensock/gsap-skills --agent claude-code
claude mcp add -s project lottiefiles-creator -- npx -y @lottiefiles/creator-mcp@latest
```
