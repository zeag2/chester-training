# Where we left off (2026-11-08)

Live at https://zeag2.github.io/chester-training/ (deploys from `main`). Work branch: `claude/wizardly-allen-ilr861`.

Done
- Shared training via Supabase (project `vtcufhddooqzckjcpzwn`): email + password accounts ("Confirm email" off),
  invite codes, onboarding asks "Set up my cat" or "Someone invited me". Sets are the shared record; progress and
  treats are replayed from them. SQL in `supabase/migrations/`, policy tests in `supabase/tests/`.
- Home greets whoever is signed in on that phone by name (editable in Settings → Training together → Your name),
  and shows "Training Chester with …" for the other trainer.
- Chester: physics rig for the sitting pose (`src/chester/rig.ts`) — lean from the hips, head/ear lag, chain tail;
  happy eyes when petted; gentle-only reactions when lying/kneading; occasional kneading; dozes after 90 s alone;
  random meows; off-screen litter box gag; rainbow dash after 8 quick taps.
- Dark mode (Settings → Appearance), Settings tab relabelled.

Next, in order
1. Chester animation pass 3: real in-between poses for hop, pounce and dance; consider real recorded meows
   (licensed) if the synth ones sound robotic. (Pass 2 done: every pose has the chain tail and head/ear lag;
   dev-only pose gallery at #/gallery.)
2. Chester's care, part 2: document and photo uploads for vet records (Supabase Storage bucket + policies);
   "Loves it" treats suggested for hard skills in sessions; reminders on Home for overdue items.
   (Part 1 done: #/care with food profiles, weight chart, symptoms, grooming, vet visits, medicine with next-due
   reminders, call-the-vet-now list; shared via the `care` table — its SQL must be run once in Supabase.)
3. Phase 2 features from the design doc: Chester's corner (spend treats), badges/trophy case, check-ins,
   photo album, weekly recap ("Josh did 4 sets, Sam did 3" — sets already record who logged them).

Notes
- Don't delete Supabase users to reset passwords: their sets cascade. Reset in Authentication → Users.
- `__chesterStore` is exposed on `globalThis` in dev builds only, for screenshots/tests.
