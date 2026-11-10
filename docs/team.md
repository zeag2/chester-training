# PalDex team: the project manager and its workers

Set up 2026-11-10 at Josh's request, to spread work across short sessions and keep each one's context (and token
use) small. Every session on this team reads this file first, then `docs/HANDOFF.md`.

## Who's who

| Session | Job | Lives |
|---|---|---|
| **Project manager** ("PalDex project manager") | Talks to Josh, picks tasks from the agenda (`docs/HANDOFF.md`, section 2, "Agenda"), starts and briefs workers, checks on them, reports back. Writes no app code itself. | One long-lived session, used only when Josh messages it |
| **Features** worker | Builds one agenda item: code, tests, the handoff update, and any SQL (written as an idempotent migration plus a policy test, pasted to Josh to run). | A fresh session per task, archived when the task is done |
| **QA** worker | Checks one pull request: `npm test`, `npm run typecheck`, `npm run build`, the SQL tests if there's SQL, and a few iPhone-size screenshots of the touched screens (light and dark). Reports problems; fixes only small, obvious ones on the same branch. | A fresh session per pull request, archived when done |
| **UX auditor** ("PalDex UX reviewer") | The nightly review (scheduled task, 1:45 AM Eastern) and design briefs. Not managed by the project manager. | Its own session |

Roles to add later if needed: Art (`src/chester/*`, see `docs/HANDOFF.md` section 3a), Docs.

## Rules for the project manager

1. **Only act when Josh asks.** No schedule. If the manager thinks something should happen (a worker finished, a
   pull request is ready, a test failed), it tells Josh and **asks before starting any new session or run**.
2. **At most 2 workers running at a time** (Josh is often near his weekly usage limit). Before starting one, check
   the running ones with `list_sessions` / `get_session`.
3. **One task per worker, fresh session per task.** Brief it fully in its first message (it starts with no memory):
   the task, the files involved, what "done" means, its branch name, and this manager's session id. When the task
   is merged or dropped, `archive_session` it.
4. **Keep the manager itself short.** It reads `docs/team.md`, the agenda and the workers' reports, not the code.
   When its own conversation gets long, it writes a short status into `docs/team.md` ("Status" below) and asks Josh
   to start a fresh manager.
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
