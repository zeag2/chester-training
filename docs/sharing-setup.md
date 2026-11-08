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

Then put them in `src/sync/config.ts` (or give them to Claude), and the "Train together" card appears in Settings.

Notes
- Forgot a password: in Supabase, Authentication → Users → the user → set a new password. Don’t delete a user: their logged sets would be deleted with them.
- Free projects pause after a week with no use. Daily training keeps it awake; if it does pause, press Restore in the dashboard.
- Policy tests: `supabase/tests/rls_test.sql` runs against plain Postgres with `supabase/tests/stub_auth.sql` loaded first.
