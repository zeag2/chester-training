# PalDex: handoff

_Last updated 2026-11-08 (Chester's corner). Start here when picking the project back up._

PalDex (repo `chester-training`) is a phone web app for clicker-training a cat, keeping its care records, and sharing both
with the people you live with. It was built for Josh's kitten **Chester** and his girlfriend **Megan**, and is now
ready to share with friends.

- **Live:** **https://paldex-4qh.pages.dev/** (Cloudflare Pages, project `paldex`; `paldex` itself was taken, hence the
  suffix). Installable to the iPhone Home Screen. The old address https://zeag2.github.io/chester-training/ still
  works: it sends new visitors to the new one and shows existing users a "PalDex has a new home" card (`MOVED_TO` in
  `src/lib/moved.ts`).
- **Deploys:** every push to `main` deploys both: Cloudflare Pages builds it (`BASE_PATH=/`), and
  `.github/workflows/pages.yml` runs tests, builds and publishes the old GitHub Pages copy. Work happens on a
  `claude/…` branch (latest: `claude/practical-einstein-7eoqfi`) and goes live once it is merged or pushed to `main`.
- **Shared data:** Supabase project `vtcufhddooqzckjcpzwn`. URL and publishable key are in `src/sync/config.ts`
  (the publishable key is meant to be public; row-level security protects the data).
- **State at handoff:** 85 tests passing in 14 files; everything is on `main` and live.

---

## 1. What's built

### Layout (tracker first, training optional; plan in `docs/plans/2026-11-08-tracker-redesign.md`)
- **Tabs: Home · Health · + · Train · Me** (`src/ui/TabBar.tsx`). A red dot on Me means a new friend.
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

### Friends (`#/friends`, from Home and Settings)
- Every account has a **friend code**; entering someone's code makes you friends both ways. Either side can remove.
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

### Multiple pets
- Settings, then Pets, then **Add another pet** (pet questions only). A switcher shows on Home when there's more than
  one pet. The pet being shown is remembered.
- Each pet has its own training, care log and documents. New pets go into the household of the pet being shown.
- **Cats only.** Dogs would need new art and a new skill set (see section 5).

### Chester's care (`#/care`, from the blue card on Home)
- **When to call the vet now:** red-flag signs, with a clear "this app doesn't diagnose".
- **Coming up:** medicine and vaccine due dates, nails and brushing getting overdue (once started), and the yearly
  checkup.
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

### Chester's corner (`#/corner`, from the yellow card on Home or "Spend treats" after a set)
- **Spend treats** on 6 outfits (bell collar, bow tie, bandana, ear flower, party hat, crown), 3 toys (box, laser dot,
  crinkle tunnel) and 3 cushions (mint, heart, cloud). Catalogue and prices: `SHOP` in `src/engine/corner.ts`.
- **Outfits show everywhere** Chester appears for that pet (Home, session, recap, settings, skill pages). They're
  drawn in head coordinates in `outfit()` in `src/chester/art.ts`, so they follow every pose, the rig and petting.
  Tap a worn outfit or cushion again to take it off.
- **Daily gift:** 2 to 6 treats once a day per pet, the same amount on every phone, shared by the household (whoever
  opens it first gets it). Home shows "New" until it's opened.
- **Play:** toys from gifts and the shop; tapping one plays a move (hop, pounce, zoomies, play bite, belly roll).
  The first play each day adds 1 bond.
- **Bond level:** 6 named levels (Getting to know you, Buddies, Pals, Best friends, Partners in crime, Soulmates)
  with a progress bar. Bond comes from gifts in sets plus daily play.
- **How it's stored and shared:** on the pet itself (`cat.corner`), which is already shared as JSON, so **no new SQL**.
  Buys, gifts and plays are an append-only log merged by id on sync (two phones never lose each other's buys; the
  gift and play ids are per day, so they can't be claimed twice). The outfit and cushion choice carry their own
  `styledAt`, so an unrelated edit on another phone never undoes them. Balance = treats from sets + the log.

### Chester himself (the character)
- **Physics rig** (`src/chester/rig.ts`): springs drive every pose. The body leans from the hips, the head and ears
  follow a beat late, and the tail is a 9-joint chain.
- **Petting:** drag across him and he leans into your finger, eyes happily closed, purring. Lying down, he nuzzles.
- **Moves on the rig:** hop, pounce, dance and yarn batting, each with wind-up, stretch, tucked legs and a landing
  squash.
- **Tap reactions:** hop, purr, flop, chin scratch, play bite, head bonk, mlem, sneeze, meow, zoomies and more. Only
  gentle ones play when he's lying, loafing or kneading.
- **Eyes and walking:** real eyelid blinks, and a diagonal-pair walk cycle. While walking the head stays level as the body
  bobs under it.
- **Head size:** `HEAD_SIZE.scale` in `src/chester/art.ts` (0.88; it was 1.0 and read as a bobblehead). It scales about
  the neck, so every pose, the rig and the outfits follow.
- **Cats together on Home:** the other cats (up to two) sit beside the one being shown (tap to switch to them), bonk
  heads now and then, and every minute or two (or on the yarn button) a **toy chase** plays: a yarn ball rolls in,
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
  Share → Add to Home Screen guide. "Not now" continues in the browser (`src/screens/Install.tsx`, `src/lib/install.ts`).
- **The app is named after the kittens** ("Chester", "Chester & Luna") on the tab, the iPhone Home Screen title and
  the install manifest (`src/lib/appname.ts`). An iPhone Home Screen app doesn't share storage with Safari, so the names
  ride into the installed app in the start address (`?pets=Chester,Luna`), and setup walks through each kitten in turn.
  An icon already on a Home Screen keeps its old name (long-press to rename, or remove and add it again).
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

## 2. What's left

Roughly in the order agreed with Josh:

1. **Next (Josh, after the demo):**
   - **Walk pose redrawn** (done, from Josh's photo of Chester standing side-on): small head on the shoulders, long
     body, tapered legs with paws, tail sweeping back. Loaf, fly and ball could get the same treatment; Josh may get
     an artist (brief: SVG, named parts, flat colour regions, same canvas per pose). **Style guide for redrawing every
     pose from Josh's references: `docs/plans/2026-11-08-cat-art-style.md`.**
   - **Friends more visible + visiting**: a friends' cats strip on Home; tap a friend's cat to visit (big, pettable,
     same reactions), and **give them a free treat** once a day. Needs SQL: a `friend_treats(from, cat_id, day)` table
     plus a `give_treat(cat_id)` function; the owner's phone turns received treats into corner log entries
     (`treat-<from>-<day>`) so they count in the balance, and shows "Erin gave Chester a treat".
   - Real push notifications for new friends (Supabase function + VAPID keys). Test the iPhone setup fix on a real phone (name, icon, second cat).
2. **Corner leftovers:** nap tokens (e.g. a streak saver) aren't built; `Wallet.napTokens` and `playMoves` are unused.
   Bond levels don't unlock anything yet. More outfits/toys are easy to add (`SHOP` + `outfit()`).
2. **Weekly recap:** a "Chester's week" card: sets, success rate, what improved, and who did what ("Josh did 4 sets,
   Megan did 3"). Sets already record `by` (account id); names come from the household members.
3. **Badges and trophy case:** a badge per mastered skill, shelves by branch, closest badge on top. Recap currently
   says "Badges … arrive in the next update".
4. **Check-ins:** five quick questions every few weeks that unlock hidden skills (`wallet.checkinKeys`,
   `hiddenUnlocks` in `rules.ts`). Some skills are locked behind these today.
5. **Photo album:** a photo of the real pet at each mastery. It can reuse the `pet-docs` bucket pattern.
6. **Care extras:** suggest the "Loves it" treat when training a hard skill; a one-tap vet summary (weight trend,
   vaccines, symptoms) to show at appointments.
7. **Animation extras (optional):** new idle behaviors like stretching after a nap, grooming a paw, chasing his tail,
   or looking where you tap. Real recorded meows (licensed) if the synthesized ones sound robotic.
8. **Other animals (bigger):** dogs or others need their own art (`src/chester/art.ts` is cat-only), skills and copy.

### Open items for Josh
- Remove the **duplicate Megan** account: Settings, Household, the Megan with 0 sets, Remove from household. The
  emails only show once `20261108230000_household_tools.sql` or the households SQL (`household_people`) has run;
  the households SQL **has** been run.
- Confirm `20261108230000_household_tools.sql` was run. It isn't required now that households exist, but it's harmless.
- If his name still shows wrong anywhere: Settings, then his own row, then Your name.

---

## 3. File structure

```
src/
  main.tsx              entry: theme, self-updates, React root
  App.tsx               hash router: tabs #/home, #/health (#/health/log/<kind>), #/train, #/me; under Train #/tree,
                        #/library, #/skill/<id>, #/corner; #/session/<skill>, #/recap/<skill>, #/friends(/<code>),
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
    art.ts              SVG poses: sit, walk, ball, sleep, loaf, knead, fly; shared head; chain tail
    rig.ts              spring rig + keyframed MOVES (hop, pounce, dance, bat)
    Chester.tsx         the component: petting, taps, reactions, rainbow dash trigger
    reactions.ts        tap reactions and which ones are allowed lying down
    RainbowDash.tsx     the dash overlay
    chester.css         CSS moves (several historical layers; later rules win; see section 6)
    spring.ts           damped spring
  screens/              Home, Train, QuickLog, Session, Recap, Tree, Library, SkillPage, Settings (Me), Care (Health),
                        Corner, Friends, Install, Onboarding,
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
  ui/                   TabBar, icons, router
  styles/app.css        tokens (light + dark), layout, components
supabase/
  migrations/           SQL, run by hand in the Supabase SQL editor, in this order:
    20261107230000_shared_training.sql   cats, cat_members, sets, RLS, join_cat
    20261108120000_care.sql              care table
    20261108180000_vet_docs.sql          pet-docs storage bucket + policies, 'doc' care kind
    20261108230000_household_tools.sql   cat_people, member removal (superseded by households, harmless)
    20261109000000_households.sql        households, migration of existing sharing, join_household, household_people
    20261110000000_friends.sql           friend codes, friendships, pet cards, add_friend/friend_pets/set_pet_card
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

## 4. How to work on it

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

Files: the claudedesignskills, reanimate, earshot and huashu skills live in `.agents/skills/` with symlinks in
`.claude/skills/`; the GSAP and Lottie skills are copied straight into `.claude/skills/`.

### Cloud environment
- **`chester-training`** (personal, created 2026-11-08): package registries and MCP servers, plus
  `world.openpetfoodfacts.org`, `world.openfoodfacts.org`, `api.upcitemdb.com` (food lookups) and `paldex-4qh.pages.dev`
  (to check the live site).
  The Default environment blocks those hosts. Start PalDex cloud sessions on this one.

### MCP servers (repo, `.mcp.json`)
- `lottiefiles-creator` (`npx -y @lottiefiles/creator-mcp@latest`), added 2026-11-08. Loads from the next session;
  Claude Code asks once before trusting it. Not used yet.

### From Josh's account (every project, not in the repo)
- The account-wide skills (artifact-design, systematic-debugging, writing-handoffs and the other anthropic-skills).
- Plugins: **Icons8** was offered (Anthropic Directory) but isn't turned on yet. If it is, it could replace
  `src/ui/icons.tsx` and the corner's toy art.

### Tools used for checks (no install needed)
- Playwright with the preinstalled Chromium for screenshots and animation frames (light and dark mode). For timed
  animations, fast-forward with `page.clock` to just before the moment, then `clock.resume()` and capture in real time:
  CSS animations don't follow the fake clock.
- Chromium's fake camera (`--use-file-for-fake-video-capture` with a generated barcode video) to test the scanner.

### Install commands used (to repeat in another project)
```bash
npx -y skills add diffusionstudio/lottie --agent claude-code
npx -y skills add https://github.com/greensock/gsap-skills --agent claude-code
claude mcp add -s project lottiefiles-creator -- npx -y @lottiefiles/creator-mcp@latest
```
