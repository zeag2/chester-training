# Chester Training App — Phase 1 Implementation Plan

> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable web app Josh uses daily to clicker-train Chester: onboarding, a full-screen "Yes!" paw session with a yarn-ball timer, a recap that applies the pass rules, a skill tree and skill pages, an animated Chester, and treats plus a gift for every finished set.

**Architecture:** A React single-page app. All training rules live in pure TypeScript functions in `src/engine/` (unit-tested) operating on plain data; `src/db/` persists that data in IndexedDB; screens in `src/screens/` read and write through one store hook. Chester is a layered SVG component with CSS keyframe idle motion and one-shot reaction classes.

**Tech Stack:** Vite 8, React 19, TypeScript, vite-plugin-pwa 2, Dexie 4, Vitest 5 (+ fake-indexeddb, jsdom), GitHub Pages via GitHub Actions.

**Spec:** [Chester Training App — Design](https://claude.ai/artifact/FX5FoXUmccY9j51Gzy14o9) · visual reference: [mockup canvas](https://claude.ai/artifact/XUDEwN2g5qpSbnSoV2fnQ3)

## Global Constraints

- Sessions 1 to 3 minutes; default timer 120 s.
- Pass = reps ≥ 5, good/reps ≥ 0.8, mood ≠ Stressed. Two passes in a row at a step → next step. Last step passed → mastered.
- Struggle = last two sets at the current step each < 0.5 or Stressed → show "go easier" hint, never a penalty.
- At most 3 skills in progress. Up to 3 rewarded sets a day; later sets are logged but earn nothing.
- A set earns its gift when reps ≥ 3 or it ran ≥ 60 s; a Stressed set still earns it.
- Treats: 1 per good rep, max 30 a day.
- Every action is a visible button ≥ 44 px; no gesture-only actions; no tutorial (one-time hints from Chester).
- Animation: transform and opacity only; no reduced-motion override (Josh's call).
- Data stays on the device; every record has `catId`.
- App served under base path `/chester-training/`.

## Review Focus

1. **App killed mid-session** → the in-progress set is not lost: the session writes a draft on every rep and the recap resumes it. Test in Task 5.
2. **Day boundary** (set logged at 23:59 vs 00:01) → daily caps use local date, not UTC. Test in Task 2 (`localDay`).
3. **Recap edits** (good reps changed above reps, or reps 0) → clamped: 0 ≤ good ≤ reps; reps 0 saves nothing. Test in Task 2.
4. **Logging a mastered skill** → recorded as a review, no step change, still rewarded. Test in Task 2.
5. **First launch with sound blocked** → no error; audio starts on first tap. Test in Task 4 (audio no-ops without a context).

---

### Task 1: Scaffold, tokens, deploy pipeline

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `public/icon.svg`, `.github/workflows/pages.yml`, `vitest.config.ts`.

- [ ] Vite React-TS app with `base: '/chester-training/'`, vite-plugin-pwa (`registerType: 'autoUpdate'`, manifest name "Chester", display `standalone`, theme `#232320`, icons from `public/icon.svg`).
- [ ] Tokens from the mockup: Nunito; ink `#232320`; surfaces mint `#e6f3ee`, peach `#fdede5`, sky `#e7effa`, butter `#fbf3d8`, grey `#f4f4f1`; easing `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`, `--sine: cubic-bezier(.45,0,.55,1)`.
- [ ] Pages workflow: on push to `main`, `npm ci && npm test && npm run build`, deploy `dist` with `actions/deploy-pages`.
- [ ] Verify: `npm run build` succeeds; `npm test` runs (0 tests OK). Commit `chore: scaffold`.

### Task 2: Training engine (pure, tested)

**Files:** Create `src/engine/types.ts`, `src/engine/skills.ts`, `src/engine/rules.ts`, `src/engine/plan.ts`, `src/engine/rewards.ts`, `src/engine/day.ts`; Test `src/engine/*.test.ts`.

**Interfaces — Produces:**
- `type Mood = 'Happy' | 'Distracted' | 'Stressed'`
- `interface SkillDef { id: string; name: string; branch: 'Foundation'|'Care'|'Manners'|'Adventure'|'Tricks'; priority: 1..5; why: string; steps: string[]; tips: string; requires: string[]; hidden?: { unlockBy: string }; sources: string[] }`
- `interface SetRecord { id: string; catId: string; at: number; day: string; skillId: string; step: number; reps: number; good: number; mood: Mood; seconds: number; review: boolean; rewarded: boolean; note?: string }`
- `interface SkillProgress { skillId: string; step: number; mastered: boolean; masteredAt?: number }`
- `localDay(ts: number): string` → `YYYY-MM-DD` in local time.
- `isPass(s: SetRecord): boolean`, `isStruggling(sets: SetRecord[], p: SkillProgress): boolean`
- `applySet(p: SkillProgress, setsForSkill: SetRecord[], s: SetRecord, def: SkillDef): { progress: SkillProgress; event: 'none'|'pass'|'stepUp'|'mastered' }`
- `isUnlocked(def: SkillDef, progress: Record<string, SkillProgress>, unlockedHidden: string[]): boolean`
- `suggestNext(defs, progress, sets, today): { skill: SkillDef; reason: string }[]` (max 3 in progress; care first; review after 7 days)
- `rewardFor(s: SetRecord, setsToday: SetRecord[], treatsToday: number): { rewarded: boolean; treats: number; gift: Gift | null }`, `rollGift(rand: () => number): Gift`

- [ ] Tests first: pass at 4/5 mood Happy; fail at 4/5 Stressed; fail at 4/4 (reps < 5 → still 100% but reps<5 fails); two passes → `stepUp`; pass on last step twice → `mastered`; struggle after two <50%; `localDay` around midnight in America/Indiana/Indianapolis; clamp good ≤ reps; mastered skill → `review: true`, no step change; 4th set in a day → `rewarded: false`; treats cap at 30; set with reps 2 and 30 s → no gift; Stressed set with 5 reps → gift.
- [ ] Implement. `skills.ts` holds all 35 skills: the 17 from the tracker/mockup with their steps, plus 18 hidden (scale step-on, chin rest, car ride, pill time, eye and ear drops, tooth brushing, harness, leash walks, meeting visitors, off the counter, leave it, stay, lie down, roll over, wave, sit pretty, ring a bell, up and off), each 3–5 steps, `hidden.unlockBy` naming the check-in answer or prerequisite.
- [ ] Verify `npm test` green. Commit `feat(engine): rules, plan, rewards`.

### Task 3: Storage

**Files:** Create `src/db/db.ts`, `src/db/store.ts`; Test `src/db/store.test.ts` (fake-indexeddb).

**Interfaces — Produces:** Dexie tables `cats`, `progress`, `sets`, `wallet`, `drafts`; `useStore()` hook returning `{ cat, progress, sets, wallet, saveCat, logSet(input): Promise<{event, reward}>, saveDraft, clearDraft, draft }`. `logSet` runs `applySet` + `rewardFor` and writes atomically.

- [ ] Test: `logSet` twice with passing sets moves step 0→1 and adds treats; persisted across a fresh `Store` instance.
- [ ] Implement; commit `feat(db): local store`.

### Task 4: Chester (art, motion, sound)

**Files:** Create `src/chester/Chester.tsx`, `src/chester/coats.ts`, `src/chester/poses/*.tsx`, `src/chester/chester.css`, `src/chester/reactions.ts`, `src/lib/audio.ts`; Test `src/chester/reactions.test.ts`, `src/lib/audio.test.ts`.

**Interfaces — Produces:** `<Chester pose="sit"|"walk"|"ball"|"sleep"|"loaf" coat eyes mood="curious"|"happy"|"sleepy" anim? reaction? look? size />`; `pickReaction(last: string|null, rand): ReactionId` (11 ids, weighted, no repeat); `audio.click()`, `audio.chirp(up)`, `audio.purr(sec)`, `audio.sparkle()`, `buzz(pattern)`, all no-ops without an AudioContext.

- [ ] Art per spec: navy outline `#1d2340`, two-tone flat shading, glossy dark eyes with gold ring for Chester, pink ears and blush; 11 coats; six poses (sit, walk, ball on back, curled sleep, loaf, + bounce as sit animation).
- [ ] Idle motion (breath, head lag, ear twitches, tail base/tip follow-through, blink, glance) and reactions from the mockup (`r1`…`r11`), plus idle variations every ~5 s and eye-follow on taps.
- [ ] Tests: `pickReaction` never repeats the previous id over 500 draws; audio functions don't throw when `AudioContext` is undefined.
- [ ] Visual check: render each pose × 3 coats to PNG with Playwright and look. Commit `feat(chester): mascot`.

### Task 5: Screens

**Files:** Create `src/screens/Onboarding.tsx`, `Home.tsx`, `Session.tsx`, `Recap.tsx`, `RewardMoment.tsx`, `Tree.tsx`, `SkillPage.tsx`, `Library.tsx`, `src/ui/TabBar.tsx`, `src/ui/YarnTimer.tsx`, `src/ui/PawButton.tsx`; router via a tiny hash router `src/ui/router.ts`.

**Interfaces — Consumes:** `useStore()`, engine functions, `<Chester/>`, audio.

- [ ] Onboarding (5 steps, mockup layout) writes the Cat; first-run only.
- [ ] Home per mockup (greeting by time of day, sunbeam, today's sets as paws, Start card from `suggestNext`, heads-up card when `isStruggling`, stats count-up, success chart from sets).
- [ ] Session: full-screen `PawButton` ("Yes!"), `YarnTimer` (120 s, pause/resume), Missed / Pause / End as visible buttons; draft saved on every tap; first-session hint once.
- [ ] Recap: good/reps steppers prefilled, mood, save → `logSet` → `RewardMoment` (gift, step-up or mastery celebration).
- [ ] Tree, Skill page, Library (skills index + search) per mockup; Badges tab hidden until a skill is mastered.
- [ ] Test (jsdom): Session → 6 taps, 2 missed → End → Recap shows 6 of 8; killing and remounting Session restores the draft.
- [ ] Commit `feat(ui): phase 1 screens`.

### Task 6: Verify and ship

- [ ] Playwright on the built app at 390×844: onboarding through one full session; screenshots of every screen; fix what looks wrong.
- [ ] Code review of the whole branch (code-reviewer skill).
- [ ] Push to `zeag2/chester-training`, enable Pages (Actions source), confirm the live URL loads and installs.
