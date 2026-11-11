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
Blocks follow Josh's 5-hour resets: 12:40 PM, 5:40 PM, 10:40 PM, 3:40 AM, 8:40 AM (Josh, 2026-11-11).
Gates: Josh's "ship it"; Josh runs any SQL by hand.

| When | Work | Size / budget | Gate | Status |
|---|---|---|---|---|
| Tue Nov 10, now | Desktop step 5: PR #17 green | done / ~4% | ship it | waiting on Josh |
| Tue Nov 10, late | Art director's first run (`docs/art.md`: style rules + cosmetics ideas); on demand only, ideas come here via the PM | S / ~2% | — | running |
| **Wed Nov 11, 3:40 AM (wakeup)** | Desktop step 6 (no print) + tooltips on icon-only buttons → PR | M / 5% | ship it | done 11:58 AM: PR #19 (on #17), green; waiting on ship it |
| Wed Nov 11, 12:40 PM | Booking part 2a: reschedule + cancel → PR | M / 4% | ship it; Josh tests on iPhone | |
| **Thu Nov 12, 3:40 AM (wakeup)** | **Security review + Forgot password** (RLS on every table/bucket, auth settings, headers, deps; reset-password flow) → PR + SQL | M / 5% | Josh runs SQL; adds the reset redirect URL in Supabase | |
| Thu Nov 12, 12:40 PM | Photo feed: plan + SQL (table, new bucket, policies, test) | S / 3% | Josh runs SQL | |
| **Fri Nov 13, 3:40 AM (wakeup)** | Photo feed part 1 (upload, shrink, feed) → PR | M / 5% | needs Thu's SQL run | |
| Fri Nov 13, 12:40 PM | Feed part 1: QA + fixes | S / 4% | ship it | |
| **Sat Nov 14, 3:40 AM (wakeup)** | Photo feed part 2 (reactions, hide, delete, skill prompt) → PR | M / 5% | | |
| Sat Nov 14, 12:40 PM | Feed part 2: QA + fixes | S / 4% | ship it | |
| **Sun Nov 15, 3:40 AM (wakeup)** | Medicine reminders (in-app) → PR | M / 5% | | |
| Sun Nov 15, 12:40 PM | Booking part 2b: several cats at once → PR (desktop leftovers if budget left: Visit page two-pane) | M / 4% | ship it | |
| **Mon Nov 16, 3:40 AM (wakeup)** | Push notifications: plan + SQL draft only | S / 3% | Josh runs SQL in the day | |
| Tue Nov 17, until 3 PM | Nothing new: 10% reserve. Push build + QA after the reset | — | reset | |

Wakeups set by the PM (send_later, 3:40 AM Nov 12–16; Nov 11's was 1:40 AM): trig_01NdtWrFySkofJpH5H9X6cBS, trig_015yzWydiD1c12T7ZtBsDf3W,
trig_01NF3pijsrjvMjeHdVVRBSCs, trig_01ATt1YQmjZddfgfBdJTrCZH, trig_0179g7LHPfYABhxtC2XbcY8N, trig_0126gKbv1PYai5CEFJPhqSky.
Pencilled: Nov 15 3:40 AM may become onboarding + menu clean-up (UX brief first), medicine reminders after the reset; Josh and the PM to decide.
Overnight (Josh, 2026-11-11): wakeups may run 1–7 AM Eastern while Josh sleeps; they build and open PRs only (no
"ship it", no SQL). One worker per night; the UX audit runs at 1:45 AM too. At each wakeup the PM checks the day's
cap first and skips if it's spent. A PM restart can make a wakeup miss; the PM checks at the next one. Desktop step 7 is dropped (Josh: no keyboard shortcuts).
Total ~50% + nightly UX audit (~6%) = ~56% of the ~70% left, leaving ~14% (10% reserve + slack).
If a block runs over, the next block shrinks, not the reserve.

PM's unpaced draft (2026-11-11): now–1:40 AM desktop steps 5–7; 1:40 AM booking part 2 + photo feed plan/SQL;
6:40 AM feed part 1; 11:40 AM feed part 2 + QA; 4:40 PM medicine reminders + desktop leftovers; 9:40 PM push plan/SQL;
2:40 AM Nov 12 push build + QA. Too fast for the budget.

## Big picture
| Project | Size | Value | Open question for Josh |
|---|---|---|---|
| Push notifications (agenda 5) | L, SQL | High once the feed exists: brings friends back | After the Nov 17 reset? VAPID keys go in environment secrets |
| "Pet me?" moments *(art)* | M | High: the daily reason to open the app | Up to 3 a day, 9 AM–9 PM, as planned? |
| App Store wrapper (Capacitor) | L | Medium: haptics, real push on iPhone, store listing | **Later** (Josh, 2026-11-11): more features first; the $99/yr has to be paid for by the app |
| Paying for itself: PalDex Plus | L, SQL (Stripe) | Needed before the App Store | See "Product model" below: price and what's in Plus |
| A cleaner address | S | Medium for sharing with friends | Buy a custom domain, or a free `*.pages.dev` name? |
| Other animals (dogs) | L | Big reach, big cost (art, skills, copy) | Later, or never? |

## Product model (draft by the Executive, 2026-11-11, for Josh to decide)
Rule: the care that keeps a cat healthy is always free. People pay for extras, never to stop nagging or ads.

- **Free, forever:** logging, health, vet visits and documents, reminders, training, friends, the corner, laser and
  wand, up to 2 cats, a modest photo allowance (e.g. 50 photos).
- **PalDex Plus**, one price for the whole household: about **$2.99 a month or $19.99 a year**, with a free month.
  Unlimited photos, 3+ cats, the vet summary as a PDF, recap share images, extra themes, and a new outfit or toy each
  month. Includes "Supporter" founding price for early friends (e.g. $14.99/yr locked in).
- **Small one-time extras:** outfit and toy packs ($0.99–$2.99). Treats stay earned only, never sold.
- **No:** ads, selling data, paywalling health, guilt or streak-loss messages to push upgrades.
- **Later, maybe:** a lifetime unlock (~$39); clearly labelled links to food and litter (affiliate), opt-in.

Costs to cover (rough): Supabase Pro $25/mo once photos outgrow the free tier, Apple $99/yr, a domain ~$12/yr:
about **$450 a year**, so **~25 yearly subscribers** break even (after Apple's 15% small-business cut).
How: on the web, Stripe Checkout + a `subscriptions` table that the app reads; in the App Store, Apple in-app
purchase (RevenueCat can handle both). Build it after the photo feed, since photos are what Plus sells.
Questions for Josh: the price; is "2 cats free" right (many homes have 2); Plus per household or per person.


### Forecast (Executive, 2026-11-11; rough model, 24 months, monthly figures)
Assumptions: 60% of new homes stay past month 1, then 5% leave a month; Plus is 70% yearly ($19.99) / 30% monthly
($2.99); 1% of homes buy a $1.99 extra a month; App Store from month 7 (half of buyers, 15% cut), else Stripe (~6%);
Supabase Pro ($25) once over ~100 homes; Apple $99/yr. Josh's Claude plan is not in the costs.

| Scenario | New homes/mo (growth) | Buy Plus | Month 12 | Month 24 | 24-mo total |
|---|---|---|---|---|---|
| Low | 10 (+5%) | 3% | 75 homes, 2 Plus, net −$4/mo | 176 homes, 5 Plus, net −$21/mo | −$250 |
| Base | 25 (+10%) | 5% | 260 homes, 13 Plus, net −$6/mo | 956 homes, 48 Plus, net +$71/mo | +$280 |
| High | 50 (+20%) | 8% | 1,005 homes, 80 Plus, net +$132/mo | 9,505 homes, 760 Plus, net +$1,540/mo | +$8,400 |

Key numbers: each Plus home brings about **$1.85/mo** after fees. Running costs (~$35/mo) need **~20 Plus homes**;
also covering a $100/mo Claude plan needs **~75**. Growth (friends inviting friends) matters far more than price.
Script: rerun with new numbers on request.
