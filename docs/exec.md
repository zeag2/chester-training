# PalDex: Secretary & Executive

Session: "PalDex secretary & executive (current)", `session_019xqnwfFvQiZZLm3DhgHYmW`. Set up by Josh, 2026-11-11.

## Role (only these four)
1. **Agenda:** order and priorities, kept in step with `docs/HANDOFF.md` §2 "Agenda".
2. **Big picture:** bigger projects after the agenda; proposes them to Josh.
3. **Time blocks:** which 5-hour block (matching Josh's usage resets) does what.
4. **Strict token budget:** see below.

Not workers, pull requests, tests or code: those stay with the project manager (PM). Writes no app code and starts
no sessions. Runs only when Josh or the PM messages it (no timer). Keep replies and reading short. When its
conversation gets long, it writes its state here and asks Josh for a fresh one: the new session is titled
"PalDex secretary & executive (current)", old ones "(archive)".

The PM reports to the Executive (one or two lines) when an agenda item finishes, the agenda or plan changes, or a
block starts or ends (with % used). The PM asks the Executive before a block runs over its budget.

## Budget (strict)
Weekly limit resets **Tue Nov 17, 3 PM Eastern**. % used comes from Josh, or from `get_session` (rate_limit_info).

| Updated | Used | Left | Reserve | Days to reset | Daily cap | Block cap |
|---|---|---|---|---|---|---|
| 2026-11-11 late | ~30% (all today) | ~70% | 10% | ~6 | ~10% | ~4–6% |

Rules: each block in the schedule names its size (S/M/L) and budget. When the day's cap is reached, no new work
starts until the next day. The 10% reserve is for fixes and Josh's own chats. Remember the UX auditor's nightly run
(1:45 AM Eastern) also spends from the same limit. Update this table at the start and end of each block.

## Schedule (time blocks, Eastern)
Gates: Josh's "ship it"; Josh runs any SQL by hand.

| When | Work | Size / budget | Gate | Status |
|---|---|---|---|---|
| Tue Nov 10, now–1:40 AM | Desktop step 5, Health in two columns (running) | M / 4% | ship it | running |
| Wed Nov 11, 11:40 AM–4:40 PM | Desktop step 6 (no print) + tooltips on icon-only buttons | M / 5% | ship it | next |
| Wed Nov 11, 4:40–9:40 PM | Booking part 2a: reschedule + cancel (.ics UID/SEQUENCE) | M / 4% | ship it; Josh tests on iPhone | |
| Thu Nov 12, 11:40 AM–4:40 PM | Booking part 2b: several cats at once | M / 5% | ship it | |
| Thu Nov 12, 4:40–9:40 PM | Photo feed: plan + SQL (table, new bucket, policies, test) | S / 3% | Josh runs SQL | |
| Fri Nov 13, 11:40 AM–9:40 PM | Photo feed part 1 (upload, shrink, feed) + QA | L / 9% | SQL run; ship it | |
| Sat Nov 14, 11:40 AM–9:40 PM | Photo feed part 2 (reactions, hide, delete, mastered-skill prompt) + QA | L / 9% | ship it | |
| Sun Nov 15, 11:40 AM–9:40 PM | Medicine reminders (in-app) + desktop leftovers | M+S / 8% | ship it | |
| Mon Nov 16, 11:40 AM–4:40 PM | Push notifications: plan + SQL only | S / 3% | Josh runs SQL | |
| Tue Nov 17, until 3 PM | Nothing new: 10% reserve. Push build + QA after the reset | — | reset | |

Total ~50% + nightly UX audit (~1% a night, ~6%) = ~56% of the ~70% left, leaving ~14% (10% reserve + slack).
Nights (9:40 PM–11:40 AM) are off except the audit. If a block runs over, the next block shrinks, not the reserve.

PM's unpaced draft (2026-11-11): now–1:40 AM desktop steps 5–7; 1:40 AM booking part 2 + photo feed plan/SQL;
6:40 AM feed part 1; 11:40 AM feed part 2 + QA; 4:40 PM medicine reminders + desktop leftovers; 9:40 PM push plan/SQL;
2:40 AM Nov 12 push build + QA. Too fast for the budget.

## Big picture
| Project | Size | Value | Open question for Josh |
|---|---|---|---|
| Push notifications (agenda 5) | L, SQL | High once the feed exists: brings friends back | After the Nov 17 reset? VAPID keys go in environment secrets |
| "Pet me?" moments *(art)* | M | High: the daily reason to open the app | Up to 3 a day, 9 AM–9 PM, as planned? |
| App Store wrapper (Capacitor) | L | Medium: haptics, real push on iPhone, store listing | **Later** (Josh, 2026-11-11): more features first; the $99/yr has to be paid for by the app |
| Paying for itself | ? | Needed before the App Store | How should it earn: a small subscription, a one-time unlock, or cosmetic outfits? Not decided |
| A cleaner address | S | Medium for sharing with friends | Buy a custom domain, or a free `*.pages.dev` name? |
| Other animals (dogs) | L | Big reach, big cost (art, skills, copy) | Later, or never? |
