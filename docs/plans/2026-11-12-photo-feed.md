# Photo feed (agenda 4) — plan, 2026-11-12

Real photos of your cats and your friends' cats in one feed, newest first, with a paw and a short caption. Also
offered when a skill is mastered. The SQL is ready in bundle part 2 (`supabase/migrations/20261116000000_bundle.sql`).
Until the app ships this, nothing reads or writes it.

## Data (bundle part 2)
- `pet_photos` (id, cat_id, path `<cat_id>/<uuid>.jpg`, caption ≤ 140, width, height, skill, by_user, created_at).
- `photo_reactions` (photo_id, user_id): one paw per person per photo.
- `photo_hides` (user_id, photo_id): "hide" on a friend's photo, only for me.
- Bucket `pet-photos`: private, JPEG/WebP, 2 MB cap. Never `pet-docs`.
- Who sees what: `private.can_see_pet(cat)` means the pet's household, or a friend of a member. It's checked live
  against `friends`, so unfriending hides the photos at once, files included.
- Who changes what: household members post; the poster edits the caption; the poster or anyone in the household
  deletes. Paws and hides need a photo you can see.
- `photo_feed(before, n)` runs as the caller, leaves out hidden photos, and returns `paws` and `pawed`. Page with
  `before` = the last `created_at`.
- Tests: `supabase/tests/photos_test.sql`.

## Part 1: upload, shrink, feed (M)
1. **Add photo** (camera or library) on the pet's page and in the "mastered!" moment (`skill` set).
2. **Shrink on the phone** before upload: canvas to a 1600 px long side, JPEG 0.8 (usually 200–500 KB), EXIF
   dropped by the redraw (no GPS leaks). Fall back to 0.6 if over 1.5 MB.
3. Upload to `pet-photos/<cat_id>/<uuid>.jpg`, then insert the row. If the insert fails, remove the file.
4. **Feed screen** `#/feed` (Me → "Photos", and a Home card with the newest friend photo): cards with photo, pet name,
   who posted, time ago, caption. Images come from `createSignedUrls` (one call per page, 1 h), lazy-loaded with
   width and height set so the page doesn't jump. Empty state: "Post Mochi's first photo".
5. Offline: show the last page from cache; posting needs a connection (say so, don't queue).
6. Without the SQL (before Josh runs the bundle): hide the entry points (`sharingConfigured()` plus a feature probe).

## Part 2: reactions, hide, delete (S)
1. **Paw** button toggles the reaction (optimistic, undone on error), with a count. Long-press to see who pawed (later).
2. **⋯ menu**: on your household's photo, Edit caption (poster only) and Delete (confirm; removes the row, then the
   file). On a friend's photo, Hide (undo toast) and "Remove friend…" (links to the existing flow).
3. Later, once it grows past close friends: report and block. Not needed while it's only friends.

## Checks
Unit tests for the shrink math and the feed reducer. Playwright iPhone shots of the feed (light and dark) with
Supabase mocked. The policy test already covers access.
