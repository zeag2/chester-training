# Setting up shared training

Chester's shared copy lives in a free Supabase project. One-time setup, about 10 minutes.

1. **Create the project.** Sign up at supabase.com, then New project. Any name (e.g. `chester`), pick a region near you, save the database password somewhere.
2. **Create the tables.** In the project, open SQL Editor → New query, paste all of
   `supabase/migrations/20261107230000_shared_training.sql`, and press Run. It should say "Success. No rows returned".
3. **Turn off email confirmation.** Authentication → Sign In / Providers → Email → switch off "Confirm email" → Save.
   The app signs in with email and password and sends no emails. (New free projects can't edit the email templates
   without your own email sender, and the built-in sender allows only a couple of emails an hour.)
4. **Copy two values** from Project Settings → API (or the Connect button):
   - Project URL, like `https://abcdefgh.supabase.co`
   - Publishable key (starts `sb_publishable_`), or the `anon` public key on older projects.
   Both are safe to put in the app. Never share the `service_role` / secret key.

5. **Chester's care (added later).** SQL Editor → New query, paste all of
   `supabase/migrations/20261108120000_care.sql`, Run. Until this is done, care entries stay on the phone that made them.
6. **Vet documents (added later).** SQL Editor → New query, paste all of
   `supabase/migrations/20261108180000_vet_docs.sql`, Run. This makes a private `pet-docs` storage bucket.
7. **Reading documents automatically (optional).**
   - Get a Claude API key at console.anthropic.com → API keys (it starts `sk-ant-`). Add billing; each document costs a few cents.
   - Supabase → Edge Functions → Secrets → add `ANTHROPIC_API_KEY` with that key. Never put it in the app or send it in chat.
   - Supabase → Edge Functions → Deploy a new function → Via editor. Name it exactly `read-vet-doc`,
     replace the code with `supabase/functions/read-vet-doc/index.ts`, and deploy. Leave "Verify JWT" on.
   Without this step documents are still stored; you just fill in the details yourself.
8. **People list with emails + remove someone.** Run `supabase/migrations/20261108230000_household_tools.sql`.
9. **Households.** Run `supabase/migrations/20261109000000_households.sql`. Moves existing sharing into households
   (one per pet owner, keeping their invite code); from then on people join a household and see all its pets.
   The app works the old per-pet way until this is run.
10. **Friends.** Run `supabase/migrations/20261110000000_friends.sql`.
11. **Friends' treats.** Run `supabase/migrations/20261111000000_friend_treats.sql` (after step 10). Until then, visiting
    friends' cats works and the treat button says treats aren't switched on yet.
12. **One-tap daily logs.** Run `supabase/migrations/20261112000000_daily_logs.sql`. Until then, Fed/Scooped/Played and
    the daily check stay on the phone that logged them; everything else syncs.
13. **Thank-yous for treats.** Run `supabase/migrations/20261113000000_treat_thanks.sql` (after step 11).
15. **Your vet.** Run `supabase/migrations/20261115000000_vets.sql` (after step 6, households). Until then, vet
    contacts stay on the phone they were saved on.
14. **Friend requests.** Run `supabase/migrations/20261114000000_friend_requests.sql` (after step 10). Until then,
    entering a code makes you friends straight away, as before.
16. **Push notifications** (plan `docs/plans/2026-11-23-push-notifications.md`). Until all of this is done the app
    hides notifications completely. The two secret values (the cron key and the VAPID private key) come from Claude in
    chat, once; never put them in the repo, a PR or the app.
    1. SQL Editor: run `supabase/migrations/20261123000000_push.sql` (it turns on `pg_net` and `pg_cron` itself).
    2. SQL Editor, one line, with the cron key in the quotes:
       `select vault.create_secret('<cron key>', 'push_cron_key');`
       (or Integrations → Vault → Add new secret, name `push_cron_key`).
    3. Edge Functions → Secrets → add four:
       `PUSH_CRON_KEY` = the same cron key · `VAPID_PUBLIC_KEY` = the public key in `src/sync/config.ts`
       (`BEhGzXYF…`) · `VAPID_PRIVATE_KEY` = the private key · `VAPID_SUBJECT` = `mailto:` + your email.
    4. Edge Functions → Deploy a new function → Via editor. Name it exactly `send-push`, replace the code with all of
       `supabase/deploy/send-push.ts`, and deploy. Then open it → Details (or Settings) → turn **off** "Verify JWT"
       ("Enforce JWT verification") and save: the cron calls it with its own key, not a sign-in.
       (With the Supabase CLI instead: `supabase functions deploy send-push --no-verify-jwt`.)
    5. Check: Integrations → Cron shows `paldex-push-drain`, `paldex-push-meds` and `paldex-push-tidy`. Turn
       notifications on in Settings → Notifications (iPhone: from the Home Screen app), have a second account send you
       a friend request, and it arrives within a minute; the function's Logs show each call.

Then put them in `src/sync/config.ts` (or give them to Claude), and the "Train together" card appears in Settings.

Notes
- Forgot a password: in Supabase, Authentication → Users → the user → set a new password. Don’t delete a user: their logged sets would be deleted with them.
- Free projects pause after a week with no use. Daily training keeps it awake; if it does pause, press Restore in the dashboard.
- Policy tests: `supabase/tests/rls_test.sql` runs against plain Postgres with `supabase/tests/stub_auth.sql` loaded first.
