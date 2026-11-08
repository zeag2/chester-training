# PalDex: tracker first, training optional (plan, 2026-11-08)

From a demo with a friend. Decisions (Josh): five tabs, training asked per cat, in-app friend alerts now (push later),
the Home Screen icon drawn from the person's own cat(s).

## Why setup broke on iPhone (root cause)
An iPhone Home Screen app doesn't share storage with Safari, and with a web manifest present iOS takes the start
address (and may take the name) from the manifest file the page loaded with, not from our in-page edits. So the kitten
names typed before installing never reached the installed app: it showed "PalDex", never offered the second cat, and
used the static Chester icon.
Fix: on iPhone, before Add to Home Screen, drop the manifest link so iOS falls back to the page itself: the page
title (apple-mobile-web-app-title), the apple-touch-icon (drawn from their cat(s) on a canvas) and the page's own
address (which carries the names and looks). Android keeps the generated manifest (tested in Chromium).
Setup also always asks "Another cat?" at the end, so a second cat can't be lost.

## Layout: Home · Health · + · Train · Me
- **Home**: all your cats together (tap one to switch), today's reminders (meds, vaccines, nails...), last weight,
  quick-log buttons, friends' cats strip, new-friend card.
- **Health**: today's Care page (weight chart, log, vet, meds and vaccines, food, documents, red flags).
- **+**: quick log sheet: weight, symptom, food, vet visit, medicine, grooming, and a training set when training is on.
- **Train**: only cats with training on: today's sets, up next, skill tree, library, Chester's corner. A cat with
  training off sees a short "Want to try training?" card with a switch.
- **Me**: your cats (add, edit, training on/off), household, friends, app settings, backup.

## Order of work
1. Setup on iPhone: names, looks and icon carried into the installed app; "Another cat?"; training question per cat.
2. Friend alerts: check on every app open; badge on Me; new-friend card on Home.
3. The five-tab layout above (no over-design: reuse today's cards and sheets).
4. Animation: all cats on Home together, playing; a toy-chase move; clearer cat switching.
5. Later: real push notifications (needs a Supabase function and VAPID keys).
