# The Pit — mechanisms (inside-out model, grounding-corrected FINAL)

A GAMEPLAY-FIRST model of *The Pit* (Zilec/Centuri/Taito, 1982; MAME `thepit`/`thepitu1`),
re-derived from `gameplay.md`, the lap-2 RAM map (`thepit-vars-lap2.md`), the routine-lap notes
(`thepit-routine-revisions.md`), and the faithful `translated/*.js` — then **corrected against two
rounds of live MAME grounding** (`thepit-grounding-results.md`, `thepit-grounding-results-2.md`).
Confirmations were promoted, overturns applied, and new grounded facts folded in.

**Naming note:** the names in this doc are the earned, gameplay-first vocabulary. The repo's
`ram.js` still carries the older export names (`OBJ_X`, etc.) pending a rename pass, so **the hex
addresses (`0x80..`) are the stable anchor** — match on the address, not the label, when
cross-referencing code.

Every substantive claim is tagged with its evidence level. This document once existed to *drive
grounding*; most of that worklist is now closed. See §3 for what remains open.

## Tags
- **`[seen]`** — directly observed in the running game (MAME `thepitu1`, 0.288-class: headless
  per-frame RAM dump + rendered frames, forced via DK "poke, don't grind" Lua tapes). Highest
  authority. Citations give the tape/frame/RAM evidence.
- **`[code]`** — proven from the translated routines + the named RAM map, but not (or not yet)
  observed live.
- **`[guess]`** — inferred, not observed. Do not promote without grounding. (The prior doc
  mis-declared "no laser exists" as a verdict; it was an ungrounded guess and it was wrong.)

Where a claim is both grounded AND code-proven it carries both tags.

---

## 1. The game model — what The Pit IS

You are an **Astronaut-Explorer** who has landed on a forbidden planet. You **dig down** through a
tunnel field to a bottom treasure chamber, **grab jewels**, and **climb/escape back up to your
ship** — the last stretch of which is the **"Pit."** A rival craft has also landed; **rival
explorers** roam the tunnels, and a tank called the **Zonker** slowly erodes a mountain by your
ship. `[seen]` (premise from gameplay.md; the mechanical consequences corrected by grounding below)

**Cast:**
- **Player** — astronaut; digs automatically by moving through dirt; fires a horizontal **laser**.
  `[seen]` (laser fire + bolt flight both observed, §2.3)
- **Three roaming enemies** ("rival explorers") — records `0x80e8`, `0x80f9`, `0x810a`, self-moving
  hostiles that wander the tunnels. `0x810a` is **enemy #3**, *not* a ship. `[seen]`
  (`0x810a` observed roaming as a live hostile — X drifts 0xe3→0xd5, Y 0x23→0x33, walk-cycle tiles
  0x16/15/14/17; grounding-1 G.17)
- **The saucer / "ship" (top-left) and the "ZONKER" tank (top-right)** are **background scenery**:
  the board intro borrows enemy #3's sprite pair (slots 6&7) to fly them into place, then bakes
  each into the background tilemap and frees the sprite. `[seen]` (both visible as baked scenery in
  `frame_1180_cw.png`; G.17)
- **The Zonker** doubles as an **idle-pressure animation** via a mountain-erosion mechanic (§2.6) —
  but it does **not** destroy your ship or cost a life (overturn, §2.6). `[seen]`
- **Hazards** — falling rocks and raining arrows (both are the SAME falling-hazard object with a
  different glyph, §2.5), plus the **Pit** crossing. They **block/obstruct**; only enemy contact
  and the transition-timer are lethal (§2.4). `[seen]`/`[code]`
- **Jewels** — crystals and diamonds you collect for points (§2.8). `[seen]`

**Objective / win:** dig down, collect jewels, escape back up and reboard the ship by crossing the
Pit; the board then rebuilds one level higher and faster. `[seen]` (board-complete → level++ →
fresh-board loop observed end-to-end, §2.9)

**Lose:** run out of lives. A whole-ROM enumeration finds **exactly two** things that take a life
(§2.4): **(1) enemy contact** (`loc_3203` catch → countdown → `loc_0278`) and **(2) the
transition-timer expiring in death mode** (`loc_13c9`, `0x807d==0` → `loc_0278`). Falling rocks,
arrows, the Pit, and the Zonker/mountain are **NOT** independently lethal. `[seen]`/`[code]`
Starting lives = 3 (DSW `0x8053`, live count `0x802b`). `[seen]`

---

## 2. Subsystems

### 2.1 Frame loop, game state, input, RNG

**Main loop** `loc_0348` runs forever; each pass it re-seats SP, kicks the watchdog (reads
`0xb800`), then calls, in order: `[code]`
1. `0x4b14` — per-frame service (timers/coin/sound drain).
2. `0x03e8` **only when gameState (`0x8001`) == 4** — the attract-**demo** wall-sense/autopilot nav.
3. `0x13c9 → 0x13de` — the **player dispatcher** — which is ALSO the **master board-transition
   gate** (§2.9): before dispatching movement it counts `transitionTimer 0x807c` down, and on
   expiry vectors to death or advance by `postTransitionMode 0x807d`. `[seen]`/`[code]`
4. `0x241c` — **mountain erosion / Zonker animation** (§2.6).
5. `0x06ac` — per-frame service.
6. `0x24f3` — **the laser**, which then **tail-chains the entire actor pipeline** (§2.3).
7. a busy-delay of length `frameDelay` (`0x8011`) — the frame-rate throttle (drops 9→8 at level 2,
   = `speedBase 0x804e − level`; observed, §2.9). `[seen]`

**The actor tail-chain** (one long jp-chain, all `[code]`):
`0x24f3` laser → `0x29ad` dig-carve/falling-hazards → `0x2f71` Zonker tank+shell →
`0x312d`/`0x316f` enemies 1&2 → `0x3748` ship/enemy-3. So laser, digging, hazards, the Zonker,
enemies and enemy-3 are all updated as one chain kicked off by the laser routine each frame.

**gameState `0x8001`:** 0 attract · 1 one-player game · 2 two-player · 3 credit-standby · 4 attract
demo. `[seen]`/`[code]` (grounding pinned the coin→start→play flow: coin@f400, start@f460, `0x8001`
3→1 at f464, live play from ~f1180)

**Input select** `loc_1420`: states **0–2 read the real input `0x8018`**; states **≥3 read the
demo-nav byte `0x801b`** — attract-mode plays itself off a synthetic input stream. `[code]`
Input byte `0x8018` carries joystick + fire on **bit 4** (`0x10`). `[seen]`/`[code]` (fire bit4
directly drove `laserState 0x80a1` 0→1, §2.3)

**RNG** `0x800d`/`0x800e` (`loc_4b1a` steps it). Used by falling-hazard slot selection and the
Zonker shell reset. `[code]` The DK spin-RNG-pinning trick applies here if determinism is ever
needed `[guess]` (not needed for grounding — the pokes forced state directly).

**Phase counter `0x8010`** ("playPhaseCounter") is a master gate: enemies don't run until
`0x8010 ≥ 8` (`loc_312d`), enemy-3 changes behavior at `0x8010 ≥ 0x0a` (`loc_3748`), and mountain
erosion won't advance until `0x8010 ≥ 0x0a` (`loc_241c`). So `0x8010` is the **board-startup ramp**
that stages the intro → live play. `[seen]`/`[code]` (live play consistently begins at `0x8010 ≥
0x0a` ~f1180; on every board rebuild it re-ramps 0,1,2,… with the player respawning from the top)

### 2.2 Player movement & digging

The player dispatcher `loc_13de` reads a chain of gate bytes (`0x807a` busy, `0x8079` active,
`0x807b` sub-state, `0x80c1` dig-collision, `0x8075` move-mode, `0x8077` pit-cross, `0x80e6`,
`0x80e7`) and vectors to a movement handler, else falls into `loc_1420 → loc_1434`. `[code]`

- **Horizontal move + tile interaction:** `loc_1704` (sibling) and the classifier `loc_1515`/
  `loc_1568`. **Vertical move (climb / dig-down):** `loc_1a02`, gated by the climb byte `0x8080`.
  `[code]` (grounding confirmed `0x8080` is a pure movement blocker — see §2.5)
- **Tile classification** (`loc_1515`/`loc_1568`, per frame, on the cell under & ahead): `[code]`
  - **Solid / impassable tile ids** (block movement, defer the frame): `0x2a`, `0x41`, `0xc1`,
    `0x95`, `0xc4`, the `0x96–0x99` band, and `0xc5` (gated on a sub-tile bit). `[code]`
  - **Diggable "dirt" band `0x71–0x9d`:** looked up in expected-tile tables (`0x1b78` under /
    `0x1ce0` ahead for horizontal; `0x1e48`/`0x1fb0` in `loc_191f`; `0x2118`/`0x2280` in the
    vertical `loc_1a02`). On a mismatch it **arms a carve reaction** — a sprite/state code
    (`0xb5` horizontal, `0x36` in `loc_191f`, `0xf6` vertical) with phase `0x80a2` and reload
    `0x80a4` — and sets the dig-collision state. `[code]`
  - **Digging is AUTOMATIC**: the carve is armed by *moving into* a dirt tile, not by any button.
    `[seen]` + `[code]` (grounding drove the player DOWN into dirt with no fire bit and watched
    crystals get collected as it dug, §2.8; the fire bit belongs to the laser, §2.3)
  - **Dig-carve engine** `loc_29ad`/`loc_191f`: on arming, `digCollisionState 0x80c1` → 2, dig
    arm-timer `0x80b1` → `0x40`, and **sound `0x14`** is requested (`0x4c9f`). The carve rewrites
    tilemap cells through the `0x2dc7` translation table (carved dirt → sprite ids `0xc1`/`0xc4`/
    blank `0x70`). `[code]`
- **Collectible tiles** (auto-collected when the player's cell lands on them; the cell is then
  overwritten with blank `0x70`): tile `0x3a` (crystal) and `0x3b`/`0x3c`/`0x3d` (diamond). See
  §2.8. `[seen]`/`[code]`
- **Special path tiles:** tile **`0x26` arms the prize gate `0x8076`** (enables diamond pickup);
  tile **`0x27` is the goal/rescue terminator** — reaching it latches `0x80e7` (goalZoneLatch) and
  `0x8077` (pitCrossActive) and hands to `loc_19d0` (`loc_16b9` scans for `0x27` one/one-row-down
  from the player cell). `[code]`
- **Player facing `0x8069`** takes codes `0x32`/`0x33`/`0xb2`/`0xb3` (bit 7 = horizontal mirror);
  this selects the laser direction. `[seen]`/`[code]` (grounding forced `0x8069=0x32` to launch a
  rightward bolt)
- The "must be pixel-aligned to start a dig" twitchiness players report corresponds to the
  `(col & 7)==0` grid-alignment gates in the classifiers — and was felt directly in grounding:
  navigating the player to a specific tile by input was too twitchy to reach a jewel/chamber by
  hand, so the "poke, don't grind" method was used throughout. `[code]`/`[seen]`

### 2.3 The laser

`loc_24f3` per frame handles the shared reaction/laser sprite slot (`0x8094`–`0x80a4`) and, at
`loc_26be`, reads **fire = input `0x8018` bit 4 (`0x10`)**. `[seen]`/`[code]`

- **Firing:** if fire is held, the player is facing horizontally (`0x8069` ∈ {`0x32`,`0x33`,`0xb2`,
  `0xb3`}), and the laser is **ready (`laserState 0x80a1 == 0`)**, it launches a bolt: direction
  `0x80a1` := `+8` (right) or `0xf8` (−8, left) by facing, sprite `0x8095` := `0x3a` (bolt),
  position seeded from the player (`0x8094`/`0x8097` from `0x8068`/`0x806b`), and a VRAM scan
  pointer `0x809a` seeded into the `0x9000` tilemap. `[seen]`/`[code]` (fire bit4 with horizontal
  facing drove `0x80a1` 0→1, grounding-1 D.11 — there the bolt hit the wall on launch so `0x8095`
  read `0x09` blank; a clean live launch to `0x8095=0x3a` was captured in grounding-2 Z-7 at f1253)
- **Flight:** `loc_272d` advances the bolt as a **straight beam**: the VRAM scan pointer `0x809a`
  steps **−0x20 per frame** (one tilemap column, e.g. 0x9305→0x92e5→0x92a5→…), the pixel coord
  `0x8094` advances **+8..+0x10 px per frame**, and the perpendicular coord `0x8097` stays constant
  → a straight beam down the corridor. It `cpir`-scans the wall table at `0x277a`; on a wall/edge
  match (grounding: the scan running off the VRAM edge, ptr < 0x9000) it **stops and marks the bolt
  spent** (`0x8094`:=0 / `0x80a1`:=0, sprite blank `0x8095=0x09`). So the bolt travels an
  already-cleared corridor and dies at the first wall/edge. `[seen]`/`[code]` (`tape_laser3.lua`,
  clean flight over ~24 frames then spent; grounding-2 Z-7)
- **Re-arm / rate:** **one bolt in flight at a time.** While fire is HELD after a bolt goes spent it
  stays spent; releasing fire clears `0x80a1` back to 0 (`loc_2696`) and the next press launches a
  fresh bolt. `[seen]` (grounding-1 D.11: while fire is held after a bolt goes spent it stays spent; grounding-2
  Z-7: releasing fire at f1277-1280 re-armed, and the next press at f1281 launched a fresh bolt)
- **Enemy kill:** inside the shared move/collision driver `loc_319d`, the overlap test `loc_31d0`
  compares the **laser box (`0x8094`/`0x8097`)** against the **enemy work box (`0x8083`/`0x8086`)**;
  on a hit it calls the score routine `0x4673` (**enemy = +100** — see §2.8, overturn), parks the
  enemy in death state `freeRunTick 0x8090 = 0xc0`, and jumps to the death handler `0x34da`.
  `[seen]`/`[code]`
- **Slot sharing:** the dig-carve reaction and the laser bolt time-multiplex ONE sprite slot
  (`0x8094`–`0x80a4`); `0x80a1` is laser-specific, `0x80a2`/`0x80a3`/`0x80a4` are the shared
  phase/reload/timer. `[seen]`/`[code]`
- **Which enemies are shootable:** **all three roaming enemies are shootable.** Enemies 1&2 pass
  through `loc_319d`/`loc_31d0` `[code]`; **enemy-3 (`0x810a`) too** — its driver `loc_3a13` copies
  its record into the same scratch box `0x8083` and calls the same `loc_319d`, reaching the same
  `loc_31d0` kill test. `[seen]` (grounding-2 Z-6: bolt box on enemy-3 → score `0x8031` +1 per
  overlap at f1352/1365/1373/1377; +100 each, same as enemies 1&2)

### 2.4 Enemies (rival explorers) & the two death triggers

`loc_312d`/`loc_316f` drive enemies 1&2 (records `0x80e8`, `0x80f9`, 17 bytes each); `loc_3748 →
loc_3a13` drives enemy-3 (`0x810a`) during live play. Each frame a record is `ldir`'d into the
shared work slot `0x8083`, run through `loc_319d`, copied back, and rendered. Enemies 1&2 run only
when phase `0x8010 ≥ 8`; in attract-demo only enemy 1 runs. `[seen]`/`[code]`

- **AI** `loc_319d`: a maze-follower. It derives the enemy's VRAM cell from its pixel position,
  probes neighbour tiles (`cpir` helpers `sub_33bc`/`33da`/`3410`/`3425`) keyed by its direction
  `0x8092` and column `0x8093`, and tail-jumps to a movement handler (`0x3476`/`347d`/`3484`/
  `348b`). The "wander the tunnels" feel = this local tile-probe walk. `[seen]`/`[code]` (enemy-3
  observed roaming smoothly, §1)
- **Difficulty scaling:** `loc_30de` seeds the enemy records and derives the speed pair
  `0x80f6`/`0x8107 = 0x07 − (level & 6)`, i.e. `7,5,3,1` as the level climbs. **Observed:** at the
  level-1→2 rebuild the pair went **7→5** (grounding-1 B.5, f1336) — "the game just gets faster."
  `[seen]`/`[code]`

**★ The two — and only two — death triggers** (whole-ROM enumeration, grounding-2): only two
routines write lives `0x802b` — `loc_022d` (round-init: `0x802b = dswLives 0x8053`, then `inc`) and
`loc_0278` (the death decrement). `loc_0278` is entered from **exactly two** call sites: `jp
z,0x0278` at **0x13d8** (the transition-timer path in `loc_13c9`, §2.9) and `jp z,0x0278` at
**0x345f** (the enemy-catch countdown `loc_3458`). So the entire game loses a life in exactly two
ways: `[seen]`/`[code]`

1. **Enemy contact → death** — `loc_3203` overlaps the enemy box against the **player box
   (`0x8068`/`0x806b`)**; on a hit it retargets the enemy, sets a catch sprite `0x8084 = 0x17`,
   facing `0x8069 = 0x35`, action timer `0x808b = 0x81`, and calls `0x4c9f`. `loc_3458` then ticks
   `0x808b` down and at 0 does `jp 0x0278`. **Observed live:** poking an enemy record onto the
   player fired the catch, and **lives `0x802b` 3→2 at frame 1295**, with the on-screen interstitial
   **"PLAYER 1 / 2 MEN LEFT"** (`frame_1300_cw.png`) — the first real DEATH observed.
   `[seen]`/`[code]` (grounding-1 A.1)
2. **Transition-timer expiry in death mode** — the `loc_13c9` mechanism with `0x807d==0` (§2.9).
   `[seen]`/`[code]`

- **Death → board reset (not just reposition):** after the enemy-contact death the transition
  **clears the tilemap** (~1009/1024 cells → fill `0x24` by f1330) then **redraws the fresh board**
  by f1418 (phase `0x8010`→0, playerActive `0x8079`→0, player Y `0x8068`→0 respawn-from-top,
  frameBusyLock `0x807a`→0). Tile counts at f1420 (203×`0x24`, 73×`0x70`) exactly match the
  pre-death fresh board at f1285, and `frame_1440_cw.png` matches the initial `frame_1180_cw.png`.
  Matches gameplay.md "jewels restored, tunnels erased." `[seen]`/`[code]` (grounding-1 A.3)
- **Laser-kill death & respawn (of an enemy):** a shot enemy gets `0x8090 = 0xc0`; `loc_34da`
  free-runs `0x8090`, and on the `0xff→0x00` wrap (~64 frames) vectors to `loc_34f0` (respawn).
  `[code]` (that the respawn re-enters the maze is `[guess]`)

### 2.5 Hazards — falling rocks & arrows, the Pit (they BLOCK, they don't kill)

**★ Overturn (both grounding laps):** falling rocks (and arrows) **BLOCK / freeze movement — they
do NOT take a life.** The rock spawner `loc_2c04` paints tile `0x25` and sets overlap flag
`0x8080`, but `0x8080` is read **only** as a movement blocker: in the vertical/climb routine
`loc_1a02` a nonzero `0x8080` bails straight to the epilogue (freezes climbing). None of the hazard
routines touch either death trigger (§2.4) — the whole-ROM enumeration bounds this. So the model's
old "rocks crush you / a falling hazard costs a life" is **not supported**; gameplay.md's lethal
falling hazards are, in this ROM, only obstructions. `[seen]`/`[code]` (grounding-1 A.2 code-path;
extended by the grounding-2 2-death-trigger enumeration. *Caveat:* a rock was never physically
landed on the player on-screen — the verdict is code-path-grounded plus the exhaustive enumeration,
not a single rock-on-player frame.)

- **Drop queue & falling rocks** `loc_29ad`/`loc_2bf2`/`loc_2c04`: a **24-entry pending table at
  `0x80c3`** (ROM seed `0x2dab`). When a dig disturbs it, `loc_2c04` picks a **random** non-empty
  slot (RNG `0x4b1a`, mask `0x1f`, reject ≥24), pairs left/right halves, clears the slot, and
  **paints tile `0x25`** into the mapped tilemap cell — a rock appears and falls (`0x80ac += 1`
  per frame). Record bytes: `hazardState 0x80aa=0x10`, `hazardType 0x80ab=0x06` (**rock**), lifetime
  `0x80b1` from `0x80c2`; the overlap test vs the player sets the blocker flag `0x8080`. `[code]`
- **Rock vs arrow are the SAME object, different glyph** (grounding-2 Z-9, LOCATED): `hazardType
  0x80ab` selects `0x06` rock / `0x07` arrow, and `loc_2bd3` writes `0x80ab` straight into the
  hazard sprite record's **tile byte `0x822a`** — so the type IS the glyph drawn; rock and arrow
  share identical fall physics. The **resting/seed type is `0x07` (arrow)** — seeded at board setup
  by `loc_287a` (`0x80aa=0x30, 0x80ab=0x07`, via `loc_24cf`) and on the treasure-capture path
  (`loc_2cb7 → loc_2d06 → loc_2d4e`, also `loc_28ab`/`loc_2934`; stamps tile `0x41`, sound `0x11`).
  A dig-disturbed drop flips it to `0x06` (rock) via `loc_2c04`. **Observed:** `0x80ab=0x07` is the
  resting value from board start (e.g. `collect` f588: `0x80ab=0x07, 0x80aa=0x30`); it flips to
  `0x06` only when `loc_2c04` spawns a rock. The bottom chamber's row of magenta down-arrows is
  visible baked in the tilemap (`collect_1080_r270.png`). `[seen]`/`[code]` A live *falling* arrow
  (`0x80aa=0x10`, `hazardActiveCount 0x80bd>0`) was not captured — see §3. `[guess]` on the live
  arrow-rain descent.
- **The Pit crossing** `0x8077` (sticky): set when the player reaches goal tile `0x27`; it gates
  boarding the ship at the far edge (`col ≥ 0x8a`, `loc_19d0/19e3`) and disables the laser while
  crossing. **The crossing awards no points** (grounding-2 Z-5: `0x8077=1` + position past `0x8a`
  fired `loc_19d0/19e3` and armed `0x807c=0xb4`, but score stayed 0000). By itself the cross leaves
  `0x807d=0` → the timer would expire into the DEATH branch; a *real* reboard reaches the ADVANCE
  branch only because the ship-landing actor `loc_384a` sets `0x807d=1` (§2.6/§2.9). `[seen]`/`[code]`
  The sliding-floor tile-animation and the monster beneath it live in VRAM (no work-RAM cell) and
  were not located/observed — see §3. `[guess]` (the visual only).
- **Acid vat:** there is **no distinct "acid" cell or routine in the ROM.** The word "acid" appears
  only in gameplay.md (sourced to Wikipedia / Data Driven Gamer as the pit of acid under the sliding
  floor). Best read: acid / sliding-floor / monster are gameplay.md **flavour for the ONE grounded
  Pit-crossing hazard** (`0x8077`), not separate subsystems. `[seen]`(-that-it's-absent)/`[guess]`
  (the on-screen crossing look).

### 2.6 The Zonker + mountain erosion (background animation — NOT a life-loss)

**★ Overturn (both grounding laps):** the Zonker / mountain-gone event does **NOT** cost a life.
The flyer's "the Zonker destroys your ship, costing a life" is **not implemented in this ROM.** In
90 s of pure idle, lives stayed 3 and level stayed 1 (grounding-2 Z-1); and the whole-ROM
2-death-trigger enumeration (§2.4) touches neither death site on the mountain path. Instead,
mountain-gone routes to the level-**ADVANCE** path. `[seen]`/`[code]`

- **Mountain erosion** `loc_241c` (main-loop step 4) + seed `loc_23e8`: `[seen]`/`[code]`
  - `loc_23e8` sets erosion pointer `0x8065 = 0x9104` and countdown
    `0x8067 = diffBase(0x804f) − 4×level(0x8028)` — **erosion runs faster every level** (observed
    `0x8067` cycling ~0x33→0).
  - `loc_241c` bails until phase `0x8010 ≥ 0x0a`, then each expiry walks the pointer down the
    mountain column writing tile `0x31`, advancing `0x8065` by `0x20` until the `0x92a4`/`0x93c0`
    row boundary — the mountain visibly eating away. In **pure idle** the pointer merely oscillates
    (`0x8066` 0x91↔0x92, no net progress) — the mountain animates but never fully erodes on its own
    (grounding-2 Z-1). `[seen]`
  - **When the mountain is gone** it reads `boardEndPhase 0x807b`: `[seen]`/`[code]`
    - `0x807b == 0` (pure-idle case) → `loc_24c7`: sets `0x807b = 2`, plays sound `0x4c6b`, and
      **does nothing else** — no life, no ship drop.
    - `0x807b == 1` (the **ESCAPE** case — player reached the top rung with treasure, latched by
      `loc_1a02`) → forces `shipY 0x810d = 0x16` (ship descends); the ship-landing actor `loc_384a`
      then sets `0x807d = 1` → **ADVANCE** (level++), never a life loss.
    - `0x807b ≥ 2` → `ret`.
  - **Observed** (grounding-1 A.4, forced two ways): the ship descends (X 0x00→0x24, Y 0x16→0x17),
    `loc_384a` sets `0x807d=1` + `0x807c=0x78`; on expiry → `0x02fd` → **level `0x8028` 1→2 (~f1460)**
    → full board rebuild — **lives `0x802b` stayed 3 the whole time.** `[seen]`
- **The Zonker tank + shell** `loc_2f71` (background scenery animation): `[code]`
  - Stage 1 (gated by `0x80e7`): scroll-reveals 6-tile terrain rows from ROM table `0x3048` into a
    VRAM column at `0x938c` — the mountain being drawn.
  - Stage 2: an oscillator — tank X (`0x80db`) bounces in `[0x19,0x38)`, sprite frame `0x80dc`
    toggles `0x38/0x39`, and a **shell Y (`0x80de`) accelerates downward** (step `0x80e0`) until
    `y ≥ 0x86`, where it clamps, re-rolls RNG, and resets — the tank repeatedly lobbing a shell.
  - Stage 3: publishes the 4-byte sprite record `0x822c`, biased by `0x8051` (§2.10).
- Net: the Zonker is a **visual idle-pressure animation** the flyer dramatizes — but with no
  countdown clock and no ship-kill, it exerts no mechanical life penalty in this ROM. `[seen]`

### 2.7 Enemy-3 / the ship / the board intro (one slot, triple use)

`0x810a` is a **2-sprite actor** (primary `0x810a`–`0x8112`, twin `0x811b`–`0x8123`), init'd by
`loc_36fe` and stepped by `loc_3748`/`0x3a4c`/`0x384a`/`0x3a13`/`0x38c8`/`0x3984`. `[seen]`/`[code]`
Grounding (G.17) confirmed **all three of its jobs** on one slot:

- **Intro set-piece:** during the low-phase intro this actor flies the **saucer (top-left) and
  ZONKER tank (top-right)** into place, then they're baked into the background tilemap and the
  sprite freed. Both are visible as baked scenery in `frame_1180_cw.png`. `[seen]`
- **Live enemy-3:** during live play (`0x8010 ≥ 0x0a` → `loc_3a13`) the same slot is a **roaming
  hostile** — observed drifting X 0xe3→0xd5, Y 0x23→0x33, walk-cycle tiles 0x16/15/14/17 — and it is
  **shootable** by the laser (§2.3, grounding-2 Z-6). `[seen]`
- **Event-ship:** when the mountain is gone in the escape case, the same slot becomes the
  **descending rescue ship** (`loc_384a` → advance, §2.6). `[seen]`

`loc_36fe` seeds it (primary tile `0x2e`, X `0x24`, Y 0, step `0x0100`; twin tile `0x2f`, X `0x34`);
`loc_3748` is phase-keyed on `0x8010` (0–2 move; 3–5 one-shot spawn then move; 6–8 → `0x38c8`; 9 →
`0x3984`; `≥0x0a` → `0x3a13` live enemy-3; alt `0x807b != 0` → `0x37cf`). `[code]`

### 2.8 Jewels & scoring

Collection is handled identically in the horizontal (`loc_18cf`/`loc_1515`), vertical (`loc_1a02`),
and terrain (`loc_1568`) paths, and **all scoring is displayed ×100** (grounding-2 Z-2: the BCD
field `0x8034:0x8031` renders as four digit tiles with fixed trailing zeros in the tilemap; field
`0x0060` reads **"SCORE1 6000"** on screen, `collect_1080_r270.png`). `[seen]`/`[code]`

- **Crystal** — tile `0x3a`: award routine **`0x467b`** (`BC=0x0010`, sound `0x10`), bump
  **`crystalCount 0x8081`**, blank the cell to `0x70`. **Displayed +1000.** `[seen]` (grounding-2
  Z-3: as the player dug down, `0x8081` incremented 1,2,3,4,6 in lockstep with `0x8031` = 0x10,0x20,
  0x30,0x40,0x60 — each crystal +0x10 BCD = +1000)
- **Diamond** — tiles `0x3b`/`0x3c`/`0x3d`: **gated by prizeGate `0x8076`** (armed by tile `0x26`),
  with a **one-shot latch `0x8078` (firstDiamondLatch)** — the first diamond only awards when
  `hazardActiveCount 0x80bd == 0`, sets the latch, and thereafter diamonds award directly. Award
  routine **`0x4683`** (`BC=0x0020`), bump **`diamondCount 0x8082`**, blank to `0x70`. **Displayed
  +2000.** `[seen]`/`[code]` (code path + ×100 scale confirmed; Z-2/Z-3)
- **Enemy kill** — `0x4673` (via `loc_31d0`), `BC=0x0001` → **+100 displayed.** `[seen]`
  **★ Overturn:** the old model/gameplay.md "+200 per enemy" is wrong; it is **+100** (grounding-2
  Z-2 scale + Z-6 live +1/kill on enemy-3).
- **Cross the Pit / reboard — NO separate award.** `[seen]` **★ Overturn:** there is no +1000
  "reboard" bonus. The pit-cross awards **zero** (grounding-2 Z-5). gameplay.md's "+1000 for
  crossing" is really the **crystal** (+1000); the only board reward is the `loc_3bec` bonus below.
- **Board-complete BONUS** — routine **`loc_3bec`, called by `loc_02fd`** (the level-advance
  routine), so it runs at **board-complete**. `[seen]` **★ Overturn** of gameplay.md's "6 diamonds
  doubles / 7 triples": the real rule is a **3-tier additive threshold**:
  ```
  count 0x800a = 5 + 5·(crystalCount 0x8081 == 0x04) + 5·(diamondCount 0x8082 == 0x03)  → {5, 10, 15}
  ```
  It then picks one of **three text messages** (ROM 0x4a14/0x4a21/0x4a2e, keyed by 5/10/15) and adds
  `BC=0x0010` (+1000) to the score `count` times. So the bonus = **count × 1000 = 5000 / 10000 /
  15000** — NOT a x2/x3 multiplier keyed to 6/7 diamonds. **Observed** (grounding-2 Z-4: crys=4,
  diam=3 → `0x800a=0x0f (15)`, level 1→2, score ramped 0000→0150 = **+15000**). `[seen]`/`[code]`
- **Score storage:** `scoreLo/Hi 0x8031/0x8034` (BCD), per-player `0x8032`/`0x8035` (P1),
  `0x8033`/`0x8036` (P2). `[code]`

**Treasure-reveal glyph** `loc_2d6b` (LOCATED, not rendered on-screen — grounding-2 Z-10): on a
dig/countdown expiry (`0x80b1` hits the `0x40` reload sentinel via `loc_2cb7`, `jp z,0x2d6b`) it
stamps a **fixed 5-tile glyph** (codes `0x23,0x18,0x17,0x14,0x3e` at offsets +0x3f/+0x1f/−0x01/
−0x21/−0x41 from the object pointer `0x806e`) and a 5-cell colour-`0x06` column, then **resets
`firstDiamondLatch 0x8078=0`** and arms `transitionTimer 0x807c=0xb4`. The latch-reset ties it to
the prize sequence → it is the **buried-treasure reveal.** Code role solid `[code]`; on-screen
render not captured `[guess]` (needs the full capture-window state — see §3).

### 2.9 Board flow & progression — the master transition mechanism

**★ Master board-transition mechanism** (new, grounded — grounding-1): both "lose a life" and
"advance a level" flow through **ONE** gate in the player dispatcher `loc_13c9`. Each frame it counts
`transitionTimer 0x807c` down; **on expiry it reads mode `postTransitionMode 0x807d`:**
`[seen]`/`[code]`
- **`0x807d == 0`** → `jp 0x0278` (`loc_0278`) → **decrement lives `0x802b`** → death / retry same
  board (respawn + fresh-board reset, §2.4).
- **`0x807d == 1`** → `jp 0x02fd` (`loc_02fd`) → **increment level `0x8028`** → advance: runs the
  `loc_3bec` bonus (§2.8) then rebuilds the board (`loc_031a`).

**Grounded directly** (`tape_transition.lua`, poke at f1250, timer=8): with `0x807d=1` the countdown
ran `0x807c` 8→0 over f1251-1256 and **level `0x8028` 1→2 at f1256** (lives held 3); with `0x807d=0`
the same countdown drove **lives `0x802b` 3→2 at f1256** (level held 1). `[seen]`

`0x807d` is set to 1 (advance) by the escape/reboard actors — the ship-landing `loc_384a` (§2.6) and
the pit-cross `loc_19d0/19e3` path when a real reboard completes — and left/forced 0 (death) by the
enemy-catch and bare timer paths. `[seen]`/`[code]`

- **Board-complete → level++ → fresh board → faster** (grounding-1 B.5): forcing the advance gives
  **level 1→2**, a full board rebuild (phase re-ramps 0,1,2,…; player respawns from top; ~765
  tilemap cells redrawn), and difficulty scales — enemy speed pair `0x80f6`/`0x8107` **7→5**,
  frameDelay `0x8011` **9→8** (=`speedBase 0x804e − level`), erosion base faster. `[seen]`/`[code]`
- **Two tilemaps by `level 0x8028` bit 0** (grounding-1 B.7, CONFIRMED): level-1 (bit0=1) vs level-2
  (bit0=0) settled boards differ in **60 dirt-field cells** (of 66 total), whereas a level-1
  self-comparison over time (erosion only) differs by just **4** — two genuinely distinct boulder
  layouts alternating by bit 0, matching gameplay.md's "two boulder layouts." `[seen]`/`[code]`
- **Board setup:** `loc_2f2f → loc_30de → loc_36fe` seed the enemy + ship blocks and the per-level
  difficulty; the intro then ramps `0x8010` 0→`≥0x0a`, flying the set-pieces in before live play.
  `[seen]`/`[code]`

### 2.10 Rendering

- **Tilemap** in VRAM at **`0x9000`** (0x20-wide rows). The display is rotated: **ROT270 is the
  correct upright player view** (ROT90 comes out upside-down — grounding-2). Digging, carving,
  jewel-blanking, rock/arrow-painting (`0x25`/glyph), erosion (`0x31`), and the set-piece bake all
  write here. `[seen]`/`[code]`
- **Sprite records:** player shadow `0x8220` (slot 0); reaction/laser `0x8224`; Zonker `0x822c`;
  enemies `0x8230`/`0x8234`; ship/enemy-3 slots `0x8238`/`0x823c` (6&7). Each is a 4-byte record.
  Under ROT270 the axis mapping is: **record byte0 = screen-HORIZONTAL, record byte3 = screen-
  VERTICAL** (byte0 = work-Y `0x8068`, byte3 = work-X `0x806b`; and dig-mode moves the player DOWN
  on screen while work-X `0x806b` increases → work-X = screen-vertical). `[seen]` (grounding-2 Z-8,
  two independent derivations + a frame check)
- **`spriteFlipYBias 0x8051`** — **resolves the ROT ambiguity:** it is **added into every sprite
  record's byte3, which is the screen-VERTICAL axis.** `[seen]` **★** (grounding-2 Z-8: poking
  `0x8051=0x40` shifted **every** sprite's byte3 by +0x40 — player 0x23→0x63, enemy1 0x23→0x63,
  enemy2 0x33→0x73, ship 0x00→0x40 — a universal screen-vertical shift; the player additionally
  carries a byte0/screen-horizontal component). This is the cocktail/flip bias; the AXIS is the
  grounded result (an arbitrary 0x40 was poked, not the true cocktail value).
- **Colour** RAM / draw scratch: `0x8055`–`0x8060` (run-length, fill byte, col/row, CRAM/VRAM
  pointers). `[code]`

### 2.11 Sound

- **Sound queue:** ring buffer `0x8020` with write/read indices `0x801e`/`0x801f`; helpers
  `0x4c9b`/`0x4c9f`/`0x4c77`/`0x467b`… enqueue sfx ids. The hardware **sound latch is the write side
  of `0xb800`** (its read side is the watchdog kick). `[code]`
- **Known sfx ids:** **`0x14` = dig/carve** (armed carve), **`0x10` = crystal collect** (`0x467b`),
  **`0x11` = treasure-capture** (`loc_2d4e` path), **`0x4c6b` = mountain-gone** (idle case). `[code]`
  Other ids (laser fire, boom, enemy death) are `[guess]` — handle audio by ear (no audio oracle).

---

## 3. STILL-OPEN worklist (what grounding did NOT close)

Grounding rounds 1 & 2 closed the whole lethality/death question, the board-transition + level loop,
scoring economy, laser flight, enemy-3 shootability, the flip-bias axis, the two tilemaps, and the
enemy-3/ship/scenery dual-use. The old A–H worklist is retired. Only these remain — each needs
**skilled player navigation** to a specific on-screen situation (the "poke, don't grind" method
forced RAM states but couldn't hand-navigate the twitchy player to these spots):

1. **Live arrow-rain descent** in the bottom jewel/treasure chamber — a `hazardType 0x07` hazard
   actually *falling* (`0x80aa=0x10`, `0x80bd>0`), fired via the capture sequence
   `loc_2cb7 → loc_2d4e`. The type, seed value, and mechanism are grounded in code (§2.5); only the
   live falling arrow on-screen is uncaptured. `[code]` located / `[guess]` on the live descent.
2. **The Pit sliding-floor tile-animation + its monster sprite.** The crossing **logic** is grounded
   (`pitCrossActive 0x8077`, `loc_19d0` far-edge at col≥0x8a, no points; §2.5) — but the retracting-
   floor VRAM tile animation (no work-RAM cell) and the monster beneath were not located in a
   routine or observed on-screen. The gameplay.md "acid vat" is almost certainly flavour for this
   one crossing hazard, not a separate subsystem. `[code]` (logic) / `[guess]` (the visual).
3. **The treasure-glyph render on-screen** — `loc_2d6b` (§2.8) is code-located (the 5-tile glyph +
   latch reset) but never force-triggered to a rendered frame; needs the full capture-window state.
   `[code]` located / `[guess]` on the visual.

Everything else previously tagged `[guess]` in this document has been promoted (`[seen]`) or
overturned by the two grounding docs.
