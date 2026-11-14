# Navigation brief: where the feed, the cat and Settings live

Status: **options for Josh to pick.** UX reviewer, 2026-11-14, from main `d24d914`.

## The problem
- **Tabs today:** Home · Health · **+** · Train · Me (phone); the same four plus "+ Log" in the desktop side nav.
- **The photo feed is buried:** Me → Photos, 2 taps and a scroll from anywhere, under Settings rows.
- **The cat has no page of his own.** He lives at the top of Home, and his corner (outfits, toys, play, bond) is a card
  near the bottom of Home and a link in Train. Josh wants Chester to have his own tab.
- **Me mixes four jobs:** your cats' details, people (friends, household, feed), account and sync, app settings. 15+ rows,
  so it "seems cluttered".
- **Train is a tab even for cats with training off,** where it only says "Turn on training".
- **Onboarding** is 8 steps before you see the app (welcome, joining, account, invite code, name, look, training, rewards).

## Option A: swap Train for the cat (smallest change)
`Home · Health · + · Chester · Friends`
- **Chester** (the cat's name, his face as the icon): the big pettable cat, his corner (outfits, toys, cushions, play),
  bond and gifts, and **Training** as a section (with the skill tree and trophies), shown only when training is on.
- **Friends:** the photo feed on top (post a photo), then friends' cats, requests and invite. The tab dot covers requests and new photos.
- **Me/Settings** moves to a **gear in the top-right of Home** (and at the bottom of the desktop side nav).
- Home: the cat scene stays (tap him → Chester tab), then Quick log, Today and a **newest-photo card**.
- Pros: 5 slots, same shape as today. The feed and the cat both get tabs. Cons: training is one tap deeper (fine:
  it's optional and usually started from Home's "Next up" bubble).

## Option B: the feed as Home
`Feed · Health · + · Chester · Me`
- The first screen is the feed, with Quick log pinned at the top. Pros: social and lively. Cons: logging (Josh's top
  rule, "effortless") competes with photos, and a fresh account's feed is empty. **Not recommended.**

## Option C: keep four tabs, put the feed on Home
`Home · Health · + · Chester · Me`
- The feed becomes a Home section ("Photos": newest 3 + "See all"). Train folds into Chester, as in A. Me stays a tab, but trimmed.
- Pros: least new nav. Cons: the feed stays a section, not a place, and Friends stays inside Me.

## Pick: **Option A**
It answers all three of Josh's points with one change to the tab bar, keeps logging on Home, and makes Me smaller.

**Me / Settings after A** (gear on Home, 3 groups instead of 6):
1. **Your cats:** each cat (edit look, birthday, meals a day, training on/off), Add another cat.
2. **Household & account:** people in the household, invite, your name, sign in / out, sync.
3. **App:** sound, Add to Home Screen, Download a backup.
(Friends, photos and the friend code move to the Friends tab.)

**Desktop side nav after A:** + Log · Home · Health · Chester · Friends, with the pet switcher below, and ⚙ Settings at
the bottom.

## Onboarding (folded in)
- Cut it to **3 screens before the app:** (1) Welcome with "Set up my cat" / "Someone invited me", (2) name + boy/girl + look on
  one screen, (3) "Train him too?" yes/no.
- Account creation moves **after** the first Fed tap ("Save Chester to your account so Megan can help?"), and the rewards
  explainer is cut (it shows itself the first time a treat lands).
- Invite links skip straight to the invite step, as today.

## Build steps
1. TabBar: Chester and Friends tabs, gear on Home, the routes (`#/chester`, `#/friends`) and redirects (`#/me` → settings, `#/train`
   → `#/chester#training`). (M)
2. Chester page: the cat + corner + training sections. Mostly moving existing components. (M)
3. Friends page: the feed on top of today's Friends screen. (S)
4. Settings trimmed into 3 groups. (S)
5. Home: the newest-photo card. (S)
6. Onboarding in 3 screens, with the account asked for later. (M)

## Questions for Josh
1. Should the tab say **"Chester"** (switching to the shown cat's name) or a fixed **"Cats"**?
2. Account after the first Fed tap: OK to delay sign-up like that?
