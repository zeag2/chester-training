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

Then put them in `src/sync/config.ts` (or give them to Claude), and the "Train together" card appears in Settings.

Notes
- Forgot a password: in Supabase, Authentication → Users → the user → set a new password, or delete the user and sign in again (their sets stay with the cat only if someone else is still a member).
- Free projects pause after a week with no use. Daily training keeps it awake; if it does pause, press Restore in the dashboard.
- Policy tests: `supabase/tests/rls_test.sql` runs against plain Postgres with `supabase/tests/stub_auth.sql` loaded first.
