# Frogger — gameplay (outside-in, from public sources, BLIND TO ROM)

Konami, 1981 (licensed to Sega/Gremlin in the US). Written before reading the ROM, from public/general
knowledge, to adjudicate mechanics the code can't settle later. **[uncertain]** items are from memory
and MUST be confirmed by playing MAME (`-rompath ~/Downloads`) during grounding — expect play to
overturn some. The screen is TALL (portrait).

## Objective
Guide frogs from the bottom to the five **home bays** at the top. Each frog must cross two zones: a
**road** (lower half, dodging traffic) and a **river** (upper half, crossed by riding floating objects,
since touching the water is death). Fill all five homes to clear the level; then it repeats, faster and
harder. You get a fixed number of frogs (lives); losing them all ends the game.

## The screen, bottom to top
1. Start row + score/lives.
2. **Road** — five lanes of traffic moving horizontally (alternating directions): cars, trucks, a
   bulldozer, fast racecars [uncertain exact vehicle set/order]. Contact = death.
3. **Median** — a safe bank (purple strip) between road and river. [uncertain] a snake may patrol it at
   higher levels.
4. **River** — five rows of moving objects: **logs** (short/medium/long) and **turtle** groups (some
   turtles periodically **DIVE**, sinking you if you're on them). You must ride these across; the water
   itself is lethal. Objects drift horizontally; riding one off the screen edge kills you.
5. **Home row** — five bays separated by bushes. Landing in an empty bay scores + fills it. Hazards in
   the home area: an **alligator/crocodile** whose open mouth kills [uncertain: also swims a river row],
   and side bushes / already-filled bays block entry.

## Bonuses
- A **fly/insect** appears in a home bay now and then — reach that bay to eat it for a bonus. [uncertain]
- A **lady frog** (pink) rides a river log; hop onto her to escort her home for a large bonus. [uncertain]
- **Time bonus** for the time left when a frog reaches home; a shrinking **time bar** limits each frog.

## Controls
- **4-way joystick**, one **discrete hop per press**: UP = forward, plus DOWN/LEFT/RIGHT. No fire button
  in the base game. (Confirm the exact input bits from the driver's 8255 PPI during Step 1/grounding.)

## Death / lose a frog
Hit by a vehicle · touch the water (miss a log/turtle, or ride a diving turtle under) · ride an object off
the screen edge · jump into an occupied/blocked home or the croc's mouth or the bushes · time runs out ·
[uncertain] snake contact. Lose all frogs → game over.

## Scoring & progression  [values all uncertain — confirm by play]
~10 per forward hop; ~50 reaching a home; ~200 fly; ~200 lady-frog escort; time bonus; a larger
all-five-homes level bonus; an extra frog at a score threshold. Clearing all five homes advances the
level (faster traffic, more turtle-diving, snake introduced/faster). The game loops indefinitely.

## Hardware-adjacent facts to reconcile at grounding (not blind — from the driver family)
Galaxian/Scramble-derived Konami hardware: tilemap background + hardware sprites + "bullets", an 8255 PPI
for inputs/DIPs/sound-command, a second Z80 + AY-3-8910 for sound. Frogger's coloured background bands
(blue river / black road) are a driver-specific background fill. ROT (portrait) + exact input bits +
the diving-turtle / lady-frog / snake specifics get pinned during Step 1 (driver) and grounding (MAME).

## To confirm by PLAYING (grounding, once Step 1 + a boot exist)
Vehicle set per lane · turtle-dive timing · lady-frog & fly triggers · crocodile (home vs river) · snake
introduction · exact scoring & extra-frog threshold · time-limit length · home-bay fill/priority. Ground
in MAME (never the JS engine).
