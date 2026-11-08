# Where we left off (2026-11-08)

Live at https://zeag2.github.io/chester-training/ (deploys from `main`). Work branch: `claude/wizardly-allen-ilr861`.

Done
- Shared training via Supabase (project `vtcufhddooqzckjcpzwn`): email + password accounts ("Confirm email" off),
  invite codes, onboarding asks "Set up my cat" or "Someone invited me". Sets are the shared record; progress and
  treats are replayed from them. SQL in `supabase/migrations/`, policy tests in `supabase/tests/`.
- Home greets whoever is signed in on that phone by name, and shows "Training Chester with …" for the other trainer.
- Chester: physics rig for the sitting pose (`src/chester/rig.ts`) — lean from the hips, head/ear lag, chain tail;
  happy eyes when petted; gentle-only reactions when lying/kneading; occasional kneading; dozes after 90 s alone;
  random meows; off-screen litter box gag; rainbow dash after 8 quick taps.
- Dark mode (Settings → Appearance), Settings tab relabelled.

Next, in order
1. Chester animation pass 2: rig the other poses (loaf/knead, sleep, walk, ball), real in-between poses for hop,
   pounce and dance; consider real recorded meows (licensed) if the synth ones sound robotic.
2. Chester's care: vet visits and documents (Supabase Storage), vaccine/flea/worm reminders, weight log,
   symptom log with "call the vet now" signs, food and treat profiles with likes/dislikes, grooming log.
3. Phase 2 features from the design doc: Chester's corner (spend treats), badges/trophy case, check-ins,
   photo album, weekly recap ("Josh did 4 sets, Sam did 3" — sets already record who logged them).

Notes
- Don't delete Supabase users to reset passwords: their sets cascade. Reset in Authentication → Users.
- `__chesterStore` is exposed on `globalThis` in dev builds only, for screenshots/tests.
