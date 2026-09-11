# Tempest — gameplay (outside-in, public sources, blind to the ROM)

Written from public knowledge before reading the code, per runbook §0. It is the game's
cast/objective/controls/win-lose, to adjudicate mechanics the code can't settle later.
Items flagged **[verify]** are single-source or likely to be refined by play under MAME.
MAME dates the driver 1980; the game's public release is commonly cited as **1981** — [verify].

## What it is

Tempest is a first-person tube shooter on a **color vector** display (Atari, Dave Theurer).
You look **down a three-dimensional well/tube** drawn in perspective. Your ship — the
**Blaster** (a claw/spider shape) — rides the **near rim** of the tube and moves around its
edge. Enemies climb **up the tube toward you from the far end**; you shoot down the lanes to
destroy them before they reach the rim and get you.

Each level is one tube of a fixed shape (a circle, a flat open line, a cross, a figure made of
several connected segments, etc.), divided into **lanes/segments** around its perimeter. The
tube geometry and the colour scheme change as you advance; the game cycles a set of distinct
geometries recoloured over many levels (commonly described as **16 distinct shapes** over
**99 levels** — [verify]).

## Controls

- **Spinner / rotary knob** — rotates the Blaster around the rim, one segment at a time (a
  4-bit rotary encoder; direction + speed from how fast you spin).
- **Fire** — shoots a shot straight down the lane the Blaster is on. Multiple shots can be in
  flight.
- **Superzapper** — a panic weapon: the **first** press on a level **destroys every enemy on
  screen**; a **second** press on the same level kills just **one** enemy (then it's spent
  until the next level). Recharges each level ("SUPERZAPPER RECHARGE").
- Start 1 / Start 2, coin. Cabinet is **upright, vertical (ROT270) vector monitor**; a
  cocktail mode exists (flips the view / swaps player controls).

## The enemies (climb up the lanes toward the rim)

- **Flipper** — the basic enemy; **flips from lane to adjacent lane**, and is deadly if it
  reaches your rim. Red.
- **Tanker** — carries two enemies; when shot (or on reaching the top) it **splits into two**
  (two flippers, or fuseballs/pulsars on later levels).
- **Spiker** — spirals up a lane leaving a **spike** (a growing line) in that lane. Spikes
  don't kill on the rim, but they **impale you during the end-of-level warp** if you fly down a
  lane that still has a tall spike.
- **Fuseball** — a sparking ball that **rolls along the rim between lane boundaries**, hard to
  hit (only vulnerable at certain moments) and deadly on contact. [verify: exact vulnerability]
- **Pulsar** — sits in a lane and **pulses/electrifies** it; being on an electrified lane when
  it pulses kills you. Appears on later levels.

## Round flow

1. **Skill-Step start.** At the start you pick your **starting level** from a set shown at the
   bottom, chosen with the spinner within a short timer — the available set depends on how far
   you reached in the previous game (higher previous level → more/higher starting choices).
2. **Clear the tube** — destroy all enemies before they overrun the rim. Between waves the tube
   keeps feeding enemies from the far end.
3. **Warp** — when the level is cleared you **fly down the tube** to the next level; the view
   zooms through the well. Tall **spikes** left by spikers must be shot down first or they kill
   you on the way through.
4. Colour + geometry change on the next level; difficulty ramps (faster enemies, more shots,
   pulsars/fuseballs introduced).

## Win / lose / scoring

- You **lose a life** when an enemy reaches your rim and touches the Blaster, a fuseball/pulsar
  catches you, or a spike impales you during a warp.
- **Game over** when lives run out; a high enough score lets you **enter your initials** on the
  high-score table (saved in the machine's NVRAM — persists across power-off).
- **Score** from shooting enemies (more for harder types and for hitting them deeper in the
  tube — [verify: depth bonus]), clearing levels, and unused superzapper/bonus. **Bonus lives**
  at score thresholds (a DIP-selected interval).
- DIP switches set lives (2–5), bonus-life interval, language, difficulty, and coinage.

## Notes for grounding (things play under MAME should settle)

- The exact spike/warp collision rule, fuseball vulnerability windows, and pulsar timing.
- The depth/perspective scoring, if any.
- The precise Skill-Step level-choice table (the ROM has a table; a public version exists in the
  operator manual — do NOT source names from it, ground the behaviour under MAME).
- Number of distinct tube geometries and the level→geometry/colour cycle.
