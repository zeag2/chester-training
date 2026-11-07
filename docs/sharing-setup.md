# Setting up shared training

Chester's shared copy lives in a free Supabase project. One-time setup, about 10 minutes.

1. **Create the project.** Sign up at supabase.com, then New project. Any name (e.g. `chester`), pick a region near you, save the database password somewhere.
2. **Create the tables.** In the project, open SQL Editor → New query, paste all of
   `supabase/migrations/20261107230000_shared_training.sql`, and press Run. It should say "Success. No rows returned".
3. **Turn on email codes.** Authentication → Emails → "Magic Link" template. Replace the body with:
   ```html
   <h2>Your Chester sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   Do the same for the "Confirm signup" template. (The app uses 6-digit codes, not links, because a link would open Safari instead of the home-screen app.)
4. **Copy two values** from Project Settings → API (or the Connect button):
   - Project URL, like `https://abcdefgh.supabase.co`
   - Publishable key (starts `sb_publishable_`), or the `anon` public key on older projects.
   Both are safe to put in the app. Never share the `service_role` / secret key.

Then put them in `src/sync/config.ts` (or give them to Claude), and the "Train together" card appears in Settings.

Notes
- Supabase's built-in email sender allows only a few emails an hour. Fine for two people; if codes stop arriving, wait an hour or add your own email sender under Authentication → Emails → SMTP.
- Free projects pause after a week with no use. Daily training keeps it awake; if it does pause, press Restore in the dashboard.
- Policy tests: `supabase/tests/rls_test.sql` runs against plain Postgres with `supabase/tests/stub_auth.sql` loaded first.
