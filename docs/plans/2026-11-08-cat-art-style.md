# Chester's look: style guide for the redraw (from Josh's references, 2026-11-08)

Josh shared anime stills as inspiration (a grey cat trotting, a black cat facing front, a white cat curled asleep, two
cats cheek to cheek, a white cat dozing upright, a tabby draped over a sofa arm). They're from existing shows, so use
them for **qualities only**: shapes, proportions and poses. Never copy a character's design (no Jiji/Chi lookalikes).
Real proportions come from Josh's photos of Chester: slim black kitten, amber eyes, long legs, long thin tail.

## What makes them read as cats
- **Small head, long body.** Walking and standing, the head is about a quarter of the body length and sits on the
  front of the shoulders. Only the front-facing sit can be a little chibi.
- **One thin, even outline**, slightly rounded; no heavy strokes. Flat fills with at most one soft shadow shape.
- **Very simple faces.** Content or asleep = two little curved lines. Awake = round eyes; on a black cat, light amber
  eyes are what make the face read. Tiny nose, small "w" mouth, few whiskers.
- **Tails do the acting.** Up like a question mark when trotting happily; wrapped around the paws when sitting;
  around the body when curled up.
- **Soft, rounded masses**: a curled-up cat is one oval with the head resting on its paws.

## Poses to (re)draw, in order
1. **Walk / trot** (done once, refine): tail up in a question-mark curve, face in profile or three-quarter, long legs.
2. **Sit**: smaller head than today, front paws together, **tail wrapped around the front paws**.
3. **Dozing sit**: the same, head bowed, eyes as curves (for "nap" on Home).
4. **Curled sleep**: one oval, head on paws, tail around the front (for night).
5. **Draped**: lying over an edge (the Home card or a cushion), front leg dangling, eyes closed: a new idle.
6. **Nuzzle** (two cats): cheek to cheek, eyes closed: for cats together on Home, instead of the head bonk.
7. Loaf, fly (rainbow dash) and ball (play), in the same style.

## Rules for the art (so the rig, outfits and coats keep working)
- SVG in `src/chester/art.ts`; keep the class names the rig and CSS use (`.all`, `.bodyg`, `.r-head`/`.head`,
  `.r-earL/R`, `.legFL/FR/BL/BR`, `.rtail`, `.eyes`, `.lids`, `.mclosed`, `.mopen`, `.tongue`, `.blush`).
- Colour regions stay the coat tokens (`base`, `shade`, `light`, `inner`, `nose`, `stripe`, `patches`, `point`) so
  every coat still works; eyes from `EYES`.
- Outfits are drawn in head coordinates: if the head shape changes, re-check `outfit()` (bell, bow tie, bandana,
  flower, party hat, crown, scarf).
- Check every pose in all coats with Playwright screenshots, and the moves (hop, pounce, dance, chase, litter gag,
  rainbow dash) as frame strips.
