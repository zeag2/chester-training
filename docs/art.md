# PalDex: art direction

Kept by the Art director session (see `docs/team.md`). How the cat is built: `docs/HANDOFF.md` §3a.

## Style rules
1. One thin, even outline (the coat's `line` colour); flat fills plus one soft shadow shape. No gradients, no texture.
2. Small head on a long body; very simple faces. The tail does the acting.
3. Cosmetics sit on the existing named groups (`.wear .wear-<id>`, `.head`, neck at y ≈ 128–150) so every pose,
   the rig and `HEAD_SIZE` carry them. Test every new item on all poses × coats in `#/gallery`.
4. Palette: the soft accents already used (rose `#ef8f9a`, gold `#efc44a`, teal `#2a7a6f`, blue `#3f6fb0`, red
   `#d2493f`). New colours must read on both black and white coats, light and dark mode.
5. Must read at 104 px (phone); detail is a bonus at 160 px (desktop), never required.
6. Motion over detail: an item earns its keep if it moves with him (jingles, flaps, sways) on the rig.
7. Original designs only: references give qualities, never copied characters, music or looks.

## Cosmetics ideas
Size S = one SVG group; M = new group + a little CSS/rig motion or a new shop kind; L = new scene or system.

| # | Name | One line | Size | Fits current art? |
|---|---|---|---|---|
| 1 | Knit beanie | Pom-pom beanie that bobs a beat late on head hops (hook the `.r-head` lag). | S | y |
| 2 | Raincoat + hood | Yellow slicker; hood up on a rainy day via the weather idea later. | M | y |
| 3 | Sunglasses | Flat black shades; slide down his nose on the `full` pose and the rainbow dash. | S | y |
| 4 | Wizard hat | Starry blue cone (party-hat shape, new fill + 3 stars). | S | y |
| 5 | Cape | Short red cape that flaps behind him in `fly`, `run` and `leap`. | M | y |
| 6 | Coat colour pass "seasonal tints" | Pumpkin, snow and spring palettes for the room, not the cat (Home backdrop tint). | M | y |
| 7 | Holiday sweater | Chunky knit jumper with a snowflake; December unlock. | M | y |
| 8 | Name tag | Little gold tag on the bell collar showing the cat's initial. | S | y |
| 9 | Window perch scene | A sill + window for Home on desktop's 160 px stage; birds pass, he chatters. | L | y |
| 10 | Matching outfits | Buy once, wear on every cat in the household (the chase looks like a team). | M | y |
| 11 | Streak badges | 7/30/100-day streak unlocks a sparkle collar, then a gold one, then a halo. | M | y |
| 12 | Plush toy companion | A tiny plush he carries and naps with; shows in `loaf`/`sleep`. | L | n (needs mouth/paw holding art) |

### Holidays (Josh, 2026-11-11: "holidays are coming up")
Seasonal shop items that appear for a few weeks. All are drawings only, so they can ship one at a time without new
systems. Order by date:

| When | Name | One line | Size | Fits? |
|---|---|---|---|---|
| Thanksgiving (Nov 26) | Pilgrim collar or leaf crown | Wide white collar, or a ring of orange/red leaves; `full` pose after Fed fits the day. | S | y |
| From Dec 1 | Santa hat | Red hat with a white pom that swings on hops (same idea as the beanie). | S | y |
| From Dec 1 | Holiday sweater (idea 7) | Chunky knit jumper with a snowflake. | M | y |
| Hanukkah (Dec 4–12) | Blue-and-silver scarf | The scarf shape in blue with silver stripes. | S | y |
| From Dec 1 | Reindeer antlers | Felt antlers on a headband, with a jingle bell. | S | y |
| From Dec 1 | Home: lights + gift box | String lights on the Home backdrop; a gift box he can sit in (reuse the cardboard box art). | M | y |
| New Year (Dec 31) | Party hat, gold | Gold party hat + a short confetti burst on a tap. | S | y |

Suggested first batch, before Thanksgiving: leaf crown, Santa hat, antlers (three S drawings, one worker task).
Shop items need start/end dates (a `season` field on `ShopItem`); bought items stay owned after the season.

Unlock ideas: streaks (11), friends (scarf already), seasons (7), care habits (e.g. 30 days of daily checks → raincoat).

## Open art items
- [ ] **Josh's OK on the 160 px desktop cat** (agenda item 9, step 4 merged): check Home at 1280 px, light and dark,
  that outlines don't look thin and offsets (the ×1.54 block in app.css) line up for the gag, chase and bed.
- [ ] **Rainbow dash at desktop size:** the ribbon and the swoop timing were tuned for a phone width; on a wide screen
  the 3.8 s pass may feel slow and the ribbon short. Check, then scale `PASS_MS` or speed by viewport width.
