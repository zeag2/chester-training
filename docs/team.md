# PalDex team: the project manager and its workers

Set up 2026-11-10 at Josh's request, to spread work across short sessions and keep each one's context (and token
use) small. Every session on this team reads this file first, then `docs/HANDOFF.md`.

## Who's who

| Session | Job | Lives |
|---|---|---|
| **Secretary & Executive** ("PalDex secretary & executive (current)", `session_019xqnwfFvQiZZLm3DhgHYmW`) | Above the project manager. Keeps the agenda order, the big picture, the 5-hour time blocks and a strict token budget, in `docs/exec.md`. No workers, PRs or code. | One long-lived session, used only when Josh or the PM messages it |
| **Project manager** ("PalDex project manager (current)", `session_019xqnwe2xGc6E2Zfb29YqrL`) | Talks to Josh, picks tasks from the agenda (`docs/HANDOFF.md`, section 2, "Agenda"), starts and briefs workers, checks on them, reports back. Writes no app code itself. | One long-lived session, used only when Josh messages it |
| **Art director** ("PalDex art director (current)", `session_019xqnwggt7rgfeAXJaezQTz`) | Cosmetics ideas and art direction: outfits, accessories, colours, scenes for the cats (`src/chester/*`, `docs/HANDOFF.md` §3a). Keeps an idea list in `docs/art.md` and briefs Art/Features tasks for the PM. Writes no app code, starts no sessions. | One long-lived session, used only when Josh or the PM messages it |
| **Features** worker | Builds one agenda item: code, tests, the handoff update, and any SQL (written as an idempotent migration plus a policy test, pasted to Josh to run). | A fresh session per task, archived when the task is done |
| **QA** worker | Checks one pull request: `npm test`, `npm run typecheck`, `npm run build`, the SQL tests if there's SQL, and a few iPhone-size screenshots of the touched screens (light and dark). Reports problems; fixes only small, obvious ones on the same branch. | A fresh session per pull request, archived when done |
| **UX auditor** ("PalDex UX reviewer") | The nightly review (scheduled task, 1:45 AM Eastern) and design briefs. Not managed by the project manager. | Its own session |

Roles to add later if needed: Docs.

## Rules for the project manager

0. **Reports to the Secretary & Executive** (`docs/exec.md`). Tell it in one or two lines (`send_message`) when an
   agenda item finishes, the agenda or plan changes, or a block starts or ends (with % used). Before starting a
   worker, check the current block still has budget; ask the Executive before going over. Josh still talks to the
   PM for day-to-day work and "ship it".

1. **Only act when Josh asks.** No schedule. If the manager thinks something should happen (a worker finished, a
   pull request is ready, a test failed), it tells Josh and **asks before starting any new session or run**.
2. **At most 2 workers running at a time** (Josh is often near his weekly usage limit). Before starting one, check
   the running ones with `list_sessions` / `get_session`.
3. **One task per worker, fresh session per task.** Brief it fully in its first message (it starts with no memory):
   the task, the files involved, what "done" means, its branch name, and this manager's session id. When the task
   is merged or dropped, `archive_session` it.
4. **Keep the manager itself short.** It reads `docs/team.md`, the agenda and the workers' reports, not the code.
   When its own conversation gets long, it writes a short status into `docs/team.md` ("Status" below) and asks Josh
   to start a fresh manager. Handing over: the new manager's session is titled "PalDex project manager (current)"
   and every older manager is renamed "PalDex project manager (archive)" (`set_session_title`).
5. **Nothing goes live without Josh.** Workers open pull requests; Josh merges, or tells the manager "ship it", and
   the manager tells the worker to merge (tests, typecheck and build green first) and push `main`. SQL is always run
   by Josh.
6. Report to Josh in plain words: what's running, what's ready for him, what it cost roughly (`get_session` shows a
   session's usage).

## How to start a worker (for the manager)

`create_session` with `source_url: https://github.com/zeag2/chester-training`, a title like
`PalDex · Features · <task>` or `PalDex · QA · PR #<n>`, and a first message that says:

- "You are the Features (or QA) worker on the PalDex team. Read docs/team.md (your role's rules) and
  docs/HANDOFF.md first."
- The task, in Josh's words where possible, with the plan file if there is one.
- Branch: `claude/<role>-<short-name>`; open a pull request when done (don't merge).
- "When you're done or stuck, send a short report to session <manager id> with send_message (what changed, the PR
  link, any SQL Josh must run, anything you couldn't check). Then stop."

## Rules for workers

- Work only on your task and your branch. Before pushing: `npm test && npm run typecheck && npm run build`.
- Update `docs/HANDOFF.md` for your change in the same pull request (and section 7 if you use a skill or tool).
- Don't edit another running worker's files; if two tasks touch the same file, tell the manager.
- Keep screenshots few (they're expensive): the touched screens, iPhone size, light and dark.
- Report to the manager with `send_message`, then stop. Don't start other sessions.

## Status (kept by the manager)

- 2026-11-10: team set up. Agenda next: item 3 (box and tunnel as real games, an Art-style task), item 7 (vet
  redesign steps 3–5: visit page, All documents, Summary for the vet).
- 2026-11-10 (evening): shipped PRs #2–#10 (vet redesign 3–5, box and tunnel, follow-ups, UX quick wins, audit
  fixes, vet booking fixes, booking polish + iPhone icon note, fix/delete mistaken quick logs). main a47f9ae, 204
  tests. No workers running; all sessions archived. Merges were done by the manager on GitHub after Josh's "ship it"
  (workers can't push main). Next on the agenda: item 8 (booking part 2: reschedule/cancel, several cats), then item 4
  (photo feed, SQL), item 9 (desktop layout, start with a UX brief). Open: one flaky run on main (2 tests failed once
  in one file, then passed 4 times in a row; find which). For Josh on a real iPhone: Apple/Google calendar from the
  Home Screen app, the 7-day alarm, the icon note's wording.
- 2026-11-11 (night): shipped PRs #11–#16: desktop brief, desktop steps 1–4 and 8 (side nav, sheets as dialog or
  side panel, hover and focus rings, centred screens, Home in two columns + the 160 px cat), and the flaky-test fix
  (`store.settled()`). main 0d7fea1, 228 tests. Skills added today: supabase, supabase-postgres-best-practices,
  find-skills, remotion-render (unusable without an inference.sh account; the UX auditor uses Playwright video
  instead), ask-matt. No workers running. Josh is near his weekly limit (resets Tue Nov 17, 3 PM Eastern): one worker
  at a time, skip QA on small changes, and start a fresh manager. Next: desktop steps 5 (Health in two columns),
  6 (documents preview), 7 (wider grids); then agenda 8 (booking part 2) and 4 (photo feed). Open: resizing across
  1100 px closes an open Undo toast or "What's off?" on Home; the rainbow dash could use an art pass at desktop size;
  Josh's art OK on the 160 px cat.
- 2026-11-11 (late): schedule in 5-hour blocks to match Josh's usage resets (Eastern time). Gates between blocks:
  Josh's "ship it", and Josh running the SQL by hand.
  - (Superseded: the schedule now lives in `docs/exec.md`.) Now to 1:40 AM: desktop steps 5, 6, 7 (one worker at a time, skip QA on small ones).
  - Block 1, 1:40 AM: agenda 8, booking part 2 (reschedule/cancel, several cats) + a second worker writing the photo
    feed plan and SQL.
  - Block 2, 6:40 AM: photo feed part 1 (Josh runs the SQL first): posting photos, your own cats' feed.
  - Block 3, 11:40 AM: photo feed part 2: friends' cats, reactions; QA on the whole feed.
  - Block 4, 4:40 PM: agenda 6, medicine reminders in-app + desktop leftovers (icon tooltips, the 1100 px resize
    bug, art pass on the 160 px cat and the rainbow dash).
  - Block 5, 9:40 PM: agenda 5, push notifications plan + SQL.
  - Block 6, 2:40 AM Nov 12: push notifications build + QA. Then the agenda is done.
