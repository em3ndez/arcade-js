# The Pit — mechanisms (inside-out model)

A GAMEPLAY-FIRST model of *The Pit* (Zilec/Centuri/Taito, 1982; MAME `thepit`/`thepitu1`),
re-derived from the faithful `translated/*.js` oracle, the idiomatic layer + `idiomatic/ram.js`,
the board layer (`boards/thepit/video.js`), and **three rounds of live MAME grounding** (two prior
rounds plus a nine-agent completeness pass, 2026-07-29). This edition is a wholesale rewrite: every
claim was re-checked against the current code, several prior *identities* were overturned, and a
batch of newly-grounded facts (the completion gate, the level-10 slow-motion cliff, the high-score
subsystem, the cocktail-flip value, the falling-hazard render split) were folded in.

**Naming note.** The names here are the earned, gameplay-first vocabulary; `idiomatic/ram.js` carries
matching `SCREAMING_SNAKE` exports and the idiomatic routine files carry matching camelCase names.
The hex anchors (`0x80..`, `loc_XXXX`) are the stable identity — match on the address when
cross-referencing. **The slot-3 sprite driven by `loc_2f71` off `0x80db-0x80de` is the
left-CHAMBER creature** (§2.8), *not* the "Zonker tank" — and the code now matches: `ram.js` and the
idiomatic routines carry the `CHAMBER_CREATURE_*` cell names (`0x80db-0x80de`, `0x80e3`) and the
`PIT_FLOOR_REVEAL_*` cell names (`0x80e4-0x80e6`), plus the routines `advanceChamberCreature`,
`seedChamberCreature`, `advanceChamberCreatureAnimation`, and `setChamberCreatureFrame`. **The word
"Zonker" is reserved here for the baked top-right tank scenery** (§2.9). Current layer sizes:
`translated/` = 169 routines, `idiomatic/` = 169 routine files + `ram.js`. `ram.js` names **174**
work-RAM cells (measured 2026-07-31): the 2026-07-31 centralization pass added 31 — cells that had
been referenced by raw hex or by a file-LOCAL `const` inside one routine (the enemy-3 record fields,
the enemy-work scratch slot, the per-player level/men backups, the attract demo-steer state, the
chamber-creature velocity/sprite, …), promoted to the single registry under proposer≠confirmer (two
blind derivations + a third adjudicator on splits); 8 write-only/vestigial cells are deliberately left
hex. The slot-3 creature + Pit floor-reveal cells were renamed off their old tank labels — the rename
is complete, none of the old labels remain.

**Grounding pass (2026-07-31) — 18 of the 31 new cells lifted `[code]`→`[seen]`.** A dig-gameplay and
an attract capture watched each cell's value against its code-derived role; a blind confirmer re-ran its
own certified captures and re-derived every one (measurement caveat: the attract dump-notifier tears
down on the demo's soft-reset, so an attract golden must run **≤30 s** — a 45 s run poisons the tail).
Seven matched the code-predicted **exact** value, which also cross-validated the byte-offset mapping:
`PLAYER1_LEVEL_BACKUP`=1, `PLAYER1_MEN_BACKUP`=3, `REACTION_PERIOD`=0x18, `DIG_OBJ_TIMER_RELOAD`=0x20,
`ENEMY3_MOVE_PERIOD`/`ENEMY3_TWIN_MOVE_PERIOD`=7 (=`7−(LEVEL&6)` at L1), `SECONDS_PRESCALER` decrements
1/frame 60→1→reload-60 (a `/60` divider, not a plain counter), `DEMO_STEER_SERVICE_TIMER` reloads to
0x1e=30. The other confirmed-`[seen]`: `DEMO_STEER_BAND_HINT`, `AHEAD_TILE_RAW`, `ENEMY_WORK_X`/`_Y`,
`CHAMBER_CREATURE_X_VELOCITY` (±1 bounce)/`_FALL_STEP` (accelerating signed)/`CHAMBER_CREATURE_SPRITE`
(sweep), `ENEMY3_STATE`/`ENEMY3_TARGET_COL`/`ENEMY3_TWIN_TARGET_COL`. **Left `[code]`** (owed a grounding
run): `ENEMY_WORK_ATTR` + `ENEMY1_Y` (observed but weakly-discriminating in the dig tape); and the cells
the two tapes never reach — `PLAYER2_MEN_BACKUP` (needs 2-player), `OBJECT_MOTION_MODE`/`LOCKED_COLUMN`
(need horizontal walking), `COLOUR_TEST_FILL` (boot self-test), the `ENEMY3_TWIN_STEP_*`/`_STATE` (twin
didn't spawn), `CARVE_CELL_PTR`/`PATTERN_SOURCE_PTR`/`SCORE_READOUT_DEST`, and `STACK_TOP` (a structural
SP-init constant, no cell-value to observe).

## Tags
- **`[seen]`** — directly observed in the running game (MAME `thepitu1`, 0.288-class: headless
  per-frame RAM dump + rendered frames, forced via "poke, don't grind" Lua tapes). Highest authority.
- **`[code]`** — proven from the translated routines + the named RAM map; the *mechanics* are exact
  (the lift is faithful), the *role* is inference from them.
- **`[guess]`** — inferred, not observed. Do not promote without grounding.

Where a claim is both grounded AND code-proven it carries both tags.

---

## 1. The game model — what The Pit IS

You are an **Astronaut-Explorer** on a forbidden planet. You **dig down** through a dirt/tunnel field
to a bottom treasure chamber, **grab jewels**, and **climb/escape back up to your ship** — the final
stretch of which is the **"Pit"** crossing. A rival craft has also landed; **rival explorers** roam
the tunnels. `[seen]` (premise from gameplay.md; the mechanical consequences below are grounded).

**Cast:**
- **Player** — astronaut (sprite slot 0). Digs automatically by moving through dirt; fires a
  horizontal **laser**. `[seen]`
- **Three roaming enemies** ("rival explorers") — records `0x80e8`, `0x80f9`, `0x810a`; self-moving
  hostiles that wander the tunnels. `0x810a` is **enemy #3**, a 2-sprite actor, **not** a ship.
  `[seen]` (enemy-3 observed roaming as a live hostile — X drifts 0xe3→0xd5, Y 0x23→0x33, walk-cycle
  tiles 0x16/15/14/17; grounding-1 G.17).
- **The saucer (top-left) and the "ZONKER" tank (top-right)** are **baked background scenery**: the
  board intro borrows enemy-3's sprite pair (slots 6&7) to fly them into place, then bakes each into
  the tilemap and frees the sprite (§2.9). `[seen]`
- **The chamber creature** — a live slot-3 sprite (§2.8) that bobs and drops in the left chamber.
  Canonical identity (caged specimen / decorative monster) is `[guess]`; its mechanism is `[seen]`.
- **Hazards** — falling rocks and raining arrows (the SAME falling-hazard object, different colour —
  §2.6), plus the **Pit** crossing. They **block/obstruct**; they do not take a life. `[seen]`/`[code]`
- **Jewels** — sparse crystals (×4) and diamonds (×3) you collect for points (§2.10). The ubiquitous
  red field is diggable/solid **dirt**, not loot (§2.2/§2.10). `[seen]`/`[code]`

**Objective / win.** Dig down, grab ≥1 diamond, climb back to the **top rung with a diamond in hand**,
and the ship descends to carry you off — the board then rebuilds one level higher and faster (§2.11).
`[seen]` (board-complete → level++ → fresh-board loop observed end-to-end).

**Lose.** Run out of lives. A whole-ROM enumeration finds **exactly two** things that decrement lives
`0x802b` (§2.4/§2.5). Falling rocks, arrows, the Pit, and mountain-erosion are **NOT** independently
lethal. Starting lives = 3 (DSW `0x8053` → `0x802b`). `[seen]`/`[code]`

---

## 2. Subsystems

### 2.1 Frame loop, NMI, game state, input, RNG

**Main loop** `loc_0348` runs forever; each pass it re-seats SP (`0x83ff`), kicks the watchdog (reads
`0xb800`), then calls, in order: `[code]`
1. `0x4b14` — **ENABLE the NMI** (writes `0x01` to LS259 `0xb000` b0 = the NMI mask). This is *not* a
   per-frame service routine — the per-frame service is the NMI itself (`loc_0066`). `[code]`
2. `0x03e8` **only when gameState (`0x8001`) == 4** (`call z`) — the attract-**demo** autopilot nav.
3. `0x13c9 → 0x13de` — the **player dispatcher**, which is ALSO the **master board-transition gate**
   (§2.11): it counts `transitionTimer 0x807c` down and, on expiry, vectors to death or advance by
   `postTransitionMode 0x807d`. `[seen]`/`[code]`
4. `0x241c` — **mountain erosion / rescue-ship drop** (§2.7). `[seen]`/`[code]`
5. `0x06ac` — the **jewel-glitter animator**: decrements `GLITTER_COUNTDOWN 0x805c` (wraps 0→8),
   selects one of 8 fixed jewel cells, and if the on-screen tile is a jewel glyph (0x3a–0x3d)
   colour-cycles that cell (+1 mod 8) — the twinkle. `[code]`
6. `0x24f3` — **the laser**, which then **tail-chains the entire actor pipeline** (§2.3). `[code]`
7. a busy-delay of length `frameDelay 0x8011` — the frame-rate throttle (§2.9 level-10 cliff). `[seen]`

**The actor tail-chain** (one long jp-chain, all `[code]`):
`0x24f3` laser → `0x29ad` dig-carve/falling-hazards → `0x2bd3` (hazard sprite record) → `0x2f71`
**chamber creature + Pit sliding-floor reveal** → `0x312d`/`0x316f` enemies 1&2 → `0x3748` ship/enemy-3.
So laser, digging, hazards, the chamber creature, enemies, and enemy-3 all update as one chain kicked
off by the laser routine each frame.

**The NMI** `loc_0066` (vblank, fast shadow-register idiom) does the real per-frame service: `[code]`
- acknowledges the NMI (LS259 b0 = 0), runs the coin/credit corruption watchdog (three redundant
  copies `0x8000`/`0x801c`/`0x812c` cross-checked; any mismatch → reset `0x01a4`),
- drains **one** sound-ring slot: reads `ring[0x801f]`, and writes it to the hardware sound latch
  `0xb800` **only if bit 7 is set** (`bit 7,a`/`jr z` skips it) — see §2.14,
- LDIRs the 0x20-byte sprite-staging block `0x8220 → 0x9840` (sprite RAM),
- runs **TWO independent /60 dividers**:
  - `0x8007 → 0x8010` — the **live** one: decrements `0x8007` each frame, and on the 60→0 rollover
    **increments `PLAY_PHASE_COUNTER 0x8010`** and reloads `0x8007=0x3c`.
  - `0x8006 → 0x800f` — an **undocumented, vestigial** second divider: it ticks `0x8006` and on
    rollover decrements a per-second counter `0x800f` — but **no *consumer* reads `0x800f`** in this
    ROM rev (the consumer was removed). Its own divider read-modify-writes it each rollover, so it is
    **not write-only** — it is simply **dead**. `[code]`
- debounces the two input ports (IN1 `0xa800 → 0x8015`, IN0 `0xa000 → 0x8018`, each latched only on
  two equal reads), and runs coin/credit/start accounting off the debounced edges. `[seen]`/`[code]`

**gameState `0x8001`:** 0 attract · 1 one-player game · 2 two-player · 3 credit-standby · 4 attract
demo. `[seen]`/`[code]` (grounding pinned coin@f400 → start@f460 → `0x8001` 3→1 @f464 → live play
from ~f1180).

**Input select** `loc_1420`: states **0–2 read the real input `0x8018`**; states **≥3 read the demo-
nav byte `0x801b`** — attract plays itself off a synthetic input stream. `[code]` Input `0x8018`
carries joystick + fire on **bit 4 (`0x10`)**. `[seen]`/`[code]`

**Phase counter `0x8010`** (`PLAY_PHASE_COUNTER`, the /60-ticked byte above) is the board-startup
ramp: enemies 1&2 don't run until `0x8010 ≥ 8` (`loc_312d`), enemy-3 goes live and mountain erosion
advances at `0x8010 ≥ 0x0a` (`loc_3748`/`loc_241c`). Live play consistently begins ~f1180 at
`0x8010 ≥ 0x0a`; on every board rebuild it re-ramps 0,1,2,… as the intro stages into play.
`[seen]`/`[code]`

**RNG** `0x800d`/`0x800e` (LFSR stepped by `loc_4b1a`). Used by falling-hazard slot selection and the
chamber-creature drop-reset. `[code]` The DK spin-RNG-pinning trick **works here — validated.** The
game runs the full attract fine with the RNG frozen (both a ROM-operand patch and a runtime
debugger-reset of `0x800d`/`0x800e`); neither the watchdog nor the credit-corruption check (§2.1) trips
on a frozen seed — the game does **not** reset (the "reset on a frozen RNG" reading was a truncated-trace
artifact — see decompiler-pipeline.md §Traps). The pin makes the *deterministic* structure reproducible:
`gameState`→4 demo entry is RNG-independent (the `loc_3a6f` delay loop, `0x800a` ticking 0x1e→0) and
**converges** JS↔MAME to a bounded ~20-frame cycle-free drift (JS f671 / MAME f691). The RNG-*driven*
demo content (hazard-slot selection, the chamber creature, the synthetic nav stream) is the
entropy-timing residual that legitimately can't be frame-matched — validated by the pixel gate, not a
state diff. `[seen]`/`[code]`

### 2.2 Player movement & digging

The player dispatcher `loc_13de` reads a chain of gate bytes (`0x807a` busy, `0x8079` active, `0x807b`
board-end phase, `0x80c1` dig-collision, `0x8075` move-mode, `0x8077` pit-cross, `0x80e6`, `0x80e7`)
and vectors to a movement handler, else falls into `loc_1420 → loc_1434`. `[code]`

- **Horizontal move + tile interaction:** `loc_1704`/`loc_1515`/`loc_1568`. **Vertical move
  (climb / dig-down):** `loc_1a02`, gated by the movement-blocker `0x8080` (§2.6). `[code]`
- **Tile classification** (per frame, on the cell under & ahead): `[code]`
  - **Solid / impassable ids** (block, defer the frame): `0x2a`, `0x41`, `0xc1`, `0x95`, the
    `0x96–0x99` band, `0xc4`, and `0xc5` (gated on a sub-tile bit). `[code]`
  - **Diggable "dirt" band `0x71–0x9d`:** looked up in expected-tile tables (`0x2118`/`0x2280` in the
    vertical `loc_1a02`; `0x1b78`/`0x1ce0` horizontal; `0x1e48`/`0x1fb0` in `loc_191f`). On a mismatch
    it **arms a carve reaction** (sprite/state code `0xf6` vertical / `0xb5` horizontal / `0x36` in
    `loc_191f`, phase `0x80a2`, reload `0x80a4`) and sets the dig-collision state. `[code]`
  - **Digging is AUTOMATIC** — the carve is armed by *moving into* dirt, no button. `[seen]`/`[code]`
    (grounding drove the player DOWN into dirt with no fire bit and watched crystals collected as it
    dug; the fire bit belongs to the laser, §2.3).
  - **Dig-carve engine** `loc_29ad`/`loc_191f`: on arming, `DIG_COLLISION_STATE 0x80c1` → 2, arm-timer
    `0x80b1` → `0x40`, **sound `0x14`** requested (`0x4c9f`). The carve rewrites tilemap cells through
    the `0x2dc7` translation table (carved dirt → `0xc1`/`0xc4`/blank `0x70`). `[code]`
- **★ Red pellets are DIRT, not loot.** The ubiquitous red field is diggable/solid dirt tiles
  (`0x41`/`0x95`/`0x96`/`0x9a`/`0xc1` and the `0x71–0x9d` band); digging through it **never touches
  `crystalCount 0x8081`, `diamondCount 0x8082`, or the score.** The ONLY collectibles are the sparse
  tiles `0x3a` (crystal) and `0x3b`/`0x3c`/`0x3d` (diamond). `[seen]`/`[code]` (`loc_1a02` bumps a
  counter ONLY on `0x3a`→`0x8081` and `0x3b/c/d`→`0x8082`; the dirt bands hit no counter/award).
- **Collectible tiles** (auto-collected when the player's cell lands on them; the cell is then blanked
  to `0x70`): `0x3a` (crystal), `0x3b`/`0x3c`/`0x3d` (diamond). See §2.10. `[seen]`/`[code]`
- **Special path tiles:** `0x26` arms the prize gate `0x8076` (enables diamond pickup); `0x27` is the
  goal/rescue terminator — reaching it latches `0x80e7` (goal-zone) and `0x8077` (pit-cross) and hands
  to `loc_19d0` (`loc_16b9` scans for `0x27` one row down from the player cell). `[code]`
- **Player facing `0x8069`** takes `0x32`/`0x33`/`0xb2`/`0xb3` (bit 7 = horizontal mirror); this
  selects the laser direction (§2.3). `[seen]`/`[code]`
- The "must be pixel-aligned to start a dig" twitchiness corresponds to the `(col & 7)==0` grid gates
  in the classifiers — felt directly in grounding (hand-navigation was too twitchy to reach a jewel;
  hence the "poke, don't grind" method throughout). `[code]`/`[seen]`

### 2.3 The laser

`loc_24f3` per frame handles the shared reaction/laser sprite slot (`0x8094`–`0x80a4`) and, at
`loc_26be`, reads **fire = input `0x8018` bit 4 (`0x10`)**. `[seen]`/`[code]`

- **Firing:** if fire is held, the player is facing horizontally, and the laser is **ready
  (`LASER_STATE 0x80a1 == 0`)**, it launches a bolt: direction `0x80a1` := `+8` (right) or `0xf8`
  (−8, left) by facing, sprite `0x8095` := `0x3a`, position seeded from the player, VRAM scan pointer
  `0x809a` seeded into the `0x9000` tilemap. `[seen]`/`[code]` (fire bit4 + horizontal facing drove
  `0x80a1` 0→1; clean launch to `0x8095=0x3a` captured grounding-2 Z-7 @f1253).
- **Flight:** `loc_272d` advances the bolt as a **straight beam**: the scan pointer `0x809a` steps
  **−0x20/frame** (one tilemap column), the pixel coord `0x8094` advances **+8..+0x10 px/frame**, the
  perpendicular coord `0x8097` stays constant. It `cpir`-scans the wall table at `0x277a`; on a
  wall/edge match it **stops and marks the bolt spent** (`0x8094`:=0 / `0x80a1`:=0, sprite blank
  `0x8095=0x09`). `[seen]`/`[code]` (clean flight over ~24 frames then spent; Z-7).
- **Re-arm / rate:** **one bolt in flight at a time.** While fire is HELD after a bolt goes spent it
  stays spent; releasing fire clears `0x80a1` back to 0 (`loc_2696`) and the next press launches a
  fresh bolt. `[seen]` (grounding-2 Z-7: release @f1277-1280 re-armed; next press @f1281 launched).
- **Enemy kill:** inside the shared move/collision driver `loc_319d`, the overlap test `loc_31d0`
  compares the **laser box** (`0x8094`/`0x8097`) against the **enemy work box** (`0x8083`/`0x8086`);
  on a hit it scores `0x4673` (**enemy = +100** displayed — §2.10), parks the enemy in death state
  `0x8090 = 0xc0`, and jumps to the death handler `0x34da`. `[seen]`/`[code]`
- **All three roaming enemies are shootable.** Enemies 1&2 pass through `loc_319d`/`loc_31d0`; enemy-3
  (`0x810a`) too — its driver `loc_3a13` copies its record into the same `0x8083` box and calls the
  same `loc_319d` → same `loc_31d0` kill test. `[seen]` (grounding-2 Z-6: bolt on enemy-3 → +1/overlap
  at f1352/1365/1373/1377, i.e. +100 each, same as enemies 1&2).
- **Slot sharing:** the dig-carve reaction and the laser bolt time-multiplex ONE sprite slot
  (`0x8094`–`0x80a4`); `0x80a1` is laser-specific, `0x80a2`/`0x80a3`/`0x80a4` are the shared
  phase/reload/timer. `[seen]`/`[code]`

### 2.4 Enemies (rival explorers) & difficulty scaling

`loc_312d`/`loc_316f` drive enemies 1&2 (records `0x80e8`, `0x80f9`, 17 bytes each); `loc_3748 →
loc_3a13` drives enemy-3 (`0x810a`) during live play. Each frame a record is `ldir`'d into the shared
work slot `0x8083`, run through `loc_319d`, copied back, and rendered. Enemies 1&2 run only when phase
`0x8010 ≥ 8`; in attract-demo only enemy 1 runs. **Enemy population scales with level** — the enemy-1
/ slot-4 record stays dormant at level 1 and comes alive as the level counter climbs. `[seen]`/`[code]`

- **AI** `loc_319d`: a maze-follower. It derives the enemy's VRAM cell from its pixel position, probes
  neighbour tiles (`cpir` helpers `loc_33bc`/`33da`/`3410`/`3425`) keyed by its direction `0x8092` and
  column `0x8093`, and tail-jumps to a movement handler (`0x3476`/`347d`/`3484`/`348b`). The "wander
  the tunnels" feel = this local tile-probe walk. `[seen]`/`[code]`
- **★ Speed is PERIODIC (mod 8), not monotonic.** `loc_30de` seeds the enemy records and derives the
  speed pair `ENEMY1_MOVE_PERIOD 0x80f6` / `ENEMY2_MOVE_PERIOD 0x8107 = 0x07 − (level & 0x06)`. Because
  `& 6` keeps only bits 1–2, the value depends **only on `level mod 8`**: for levels 0..7 it runs
  **7,7,5,5,3,3,1,1** and then **repeats** — it wraps back to the *slowest* (7) every 8 levels rather
  than climbing forever. `[seen]`/`[code]` (grounded: level 8/9 → 7, level 10 → 5, level 16 → 7 —
  `exp3b_9`/`exp3b_10`/`exp3_lvl_16`; a smaller `0x80f6` = faster, so lower level number ≠ slower).
  The level-1→2 rebuild's **7→5** step was also seen live (grounding-1 B.5).
- **No hard level cap.** The 8-bit level counter `0x8028` just wraps (verified to level 0xff+); only
  the board **layout** is capped at `min(level+1, 4)` distinct types, and erosion/other timers
  sawtooth with level (§2.7/§2.9). **Level 16 renders cleanly — there is no visual kill screen.**
  `[seen]`

**Difficulty seeds recomputed on every board rebuild** (`loc_30de` + `loc_23e8` + `loc_4b55` DSW
decode; `frameDelay 0x8011` is recomputed separately in `loc_031a` as `0x804e − level 0x8028`): the
enemy speed pair, `frameDelay 0x8011` (§2.9), the erosion base `0x8067`, and the chamber-creature
reveal period all scale off the level counter `0x8028`. `[seen]`/`[code]`

### 2.5 The two — and only two — death triggers

A whole-ROM enumeration finds only two writers of lives `0x802b`: `loc_022d` (round-init:
`0x802b = dswLives 0x8053`, then `inc`) and `loc_0278` (the death decrement). `loc_0278` decrements
`0x802b` with a single `dec a` at `0x0283` committed by the store `ld (0x802b),a` at `0x0284`, and is
reached lethally from **exactly two `jp z,0x0278` sites**: `[seen]`/`[code]`

1. **Enemy contact → death** — `0x345f`, the enemy-catch countdown `loc_3458`. `loc_3203` overlaps the
   enemy box against the **player box** (`0x8068`/`0x806b`); on a hit it retargets the enemy, sets a
   catch sprite `0x8084 = 0x17`, facing `0x8069 = 0x35`, action timer `0x808b = 0x81`, and calls
   `0x4c9f`. `loc_3458` ticks `0x808b` down and at 0 does `jp z,0x0278`. **Observed:** poking an enemy
   record onto the player fired the catch and **lives `0x802b` 3→2 @f1295**, with the on-screen
   interstitial **"PLAYER 1 / 2 MEN LEFT"** — the first real death observed. `[seen]`/`[code]`
   (grounding-1 A.1). This path is **somewhat separate** from the transition-timer gate (it reaches
   `loc_0278` directly at `0x345f`, not through `0x13d8`) — so it is not the case that one gate routes
   every life-loss.
2. **Transition-timer expiry in death mode** — `0x13d8`, in `loc_13c9`: when `transitionTimer 0x807c`
   expires with `postTransitionMode 0x807d == 0`, `jp z,0x0278` (§2.11). `[seen]`/`[code]`

(A third `jp` into the `0x0278` region — the `loc_022d` init fall-through — is NON-lethal, it is the
round-init that *sets* lives, not a decrement.)

- **`loc_4632` writes the per-player mirror cells.** It copies 5 stride-3 fields from `0x8028` into
  `0x8029`+ (player 1, `0x8002==1`) or `0x802a`+ (player 2): level → `0x8029`/`0x802a`, working lives
  `0x802b` → `0x802c`/`0x802d`, and the score bytes → `0x8032`/`0x8035` (P1) / `0x8033`/`0x8036` (P2).
  The **game-over gate is working lives `0x802b` reaching 0**; the mirrors carry a player's state
  across the P1↔P2 handoff. `[seen]`/`[code]`
- **Death → board reset (not just reposition):** after the enemy-contact death the transition
  **clears the tilemap** (~1009/1024 cells → `0x24`) then **redraws the fresh board** by ~f1418
  (phase `0x8010`→0, `0x8079`→0, player Y `0x8068`→0 respawn-from-top, `0x807a`→0). Tile counts match
  the pre-death fresh board frame-for-frame ("jewels restored, tunnels erased"). `[seen]`/`[code]`
  (grounding-1 A.3).
- **Laser-kill death & respawn (of an enemy):** a shot enemy gets `0x8090 = 0xc0`; `loc_34da`
  free-runs `0x8090` and on the `0xff→0x00` wrap (~64 frames) vectors to `loc_34f0` (respawn). `[code]`
  (that the respawn re-enters the maze is `[guess]`).

### 2.6 Hazards — falling rocks & arrows, the Pit (they BLOCK, they don't kill)

**Falling rocks and arrows BLOCK / freeze movement — they do NOT take a life.** `MOVE_BLOCK_FLAG
0x8080` is read **only** as a movement blocker: in the vertical/climb routine `loc_1a02` a nonzero
`0x8080` bails straight to the epilogue (freezes climbing). None of the hazard routines touch either
death trigger — the two-trigger enumeration (§2.5) bounds this. `[seen]`/`[code]` (grounding-2
enumeration; caveat: a rock was never physically landed on the player on-screen, so this is
code-path-grounded plus the exhaustive enumeration, not a single rock-on-player frame — but the
overlap case WAS held for ~1476 frames with `0x8080=1` and **zero** life loss).

- **Drop queue & spawns** `loc_29ad`/`loc_2bf2`/`loc_2c04`: a 24-entry pending table `DROP_QUEUE
  0x80c3` (ROM seed `0x2dab`). When a dig disturbs it, `loc_2c04` picks a **random** non-empty slot
  (RNG `0x4b1a`, mask `0x1f`, reject ≥24), pairs left/right halves, clears the slot, and **paints tile
  `0x25`** into the mapped cell — a hazard appears and falls (`HAZARD_Y 0x80ac += 1`/frame). Record
  bytes: `HAZARD_STATE 0x80aa`, `HAZARD_TYPE 0x80ab`, lifetime `0x80b1`. `[code]`
- **★ Rock vs arrow: SAME SHAPE, DIFFERENT COLOUR (render split corrected).** The hazard's 4-byte
  sprite record `0x8228`–`0x822b` is composed by `loc_2bd3`:
  `0x8228 = HAZARD_X 0x80a9 − bias`; `0x8229 (sprite CODE/SHAPE) = HAZARD_STATE 0x80aa`;
  `0x822a (COLOUR/attr) = HAZARD_TYPE 0x80ab`; `0x822b (Y) = HAZARD_Y 0x80ac + bias`.
  So the **SHAPE** comes from `HAZARD_STATE 0x80aa` (`0x10` falling → the down-arrow sprite) and the
  **COLOUR** from `HAZARD_TYPE 0x80ab` (`0x06` rock palette / `0x07` arrow palette). `boards/thepit/
  video.js` decodes sprite byte+2 (`0x822a`) as `color = (spr[+2]&7)`, confirming `0x822a` is the
  colour byte — so rock and arrow **fall as the same shape, drawn in a different colour**. `[code]`
  (This corrects the prior claim that `0x80ab` was written to a *tile* byte and "the type IS the glyph
  drawn"; `loc_2bd3` writes `0x80ab` into byte+2, the colour byte.)
  - The **resting/seed type is `0x07`** (arrow), seeded at board setup by `loc_287a` (`0x80aa=0x30,
    0x80ab=0x07`, via `loc_24cf`) and on the treasure-capture path (`loc_2cb7 → loc_2d06 → loc_2d4e`,
    stamps tile `0x41`, sound `0x11`). A dig-disturbed drop flips the type to `0x06` (rock) via
    `loc_2c04`. **Observed:** `0x80ab=0x07` is the resting value from board start; it flips to `0x06`
    only when `loc_2c04` spawns a rock. `[seen]`/`[code]` A live *falling* arrow-rain descent
    (`0x80aa=0x10`, `HAZARD_ACTIVE_COUNT 0x80bd>0`) was captured via a control-poke but that observation
    is **proposer-only — NOT a confirmed `[seen]`** (same agent proposed + observed; see §3). So the
    hazard cells stay `[code]` until an independent re-derivation.
- **The Pit crossing** `PIT_CROSS_ACTIVE 0x8077` (sticky): set when the player reaches goal tile
  `0x27`; it gates boarding the ship at the far edge (col ≥ 0x8a, `loc_19d0/19e3`) and disables the
  laser while crossing. **The crossing itself awards no points** (grounding-2 Z-5: score stayed 0000).
  By itself the cross leaves `0x807d=0` → the timer would expire into the DEATH branch; a *real*
  reboard reaches the ADVANCE branch only because the ship-landing actor `loc_384a` sets `0x807d=1`
  (§2.7/§2.11). `[seen]`/`[code]` The retracting-floor animation is `loc_2f71` stage 1 (§2.8).
- **Acid vat:** there is **no distinct "acid" cell or routine.** The word appears only in gameplay.md
  flavour (sourced to Wikipedia / Data Driven Gamer). Best read: acid / sliding-floor / creature are
  flavour for the ONE grounded Pit-crossing hazard + the §2.8 chamber creature. `[seen]`(-absent).

### 2.7 Mountain erosion & the escape / rescue-ship (the real completion path)

**Mountain erosion does NOT cost a life** — the flyer's "the Zonker destroys your ship, costing a
life" is **not implemented in this ROM.** In 90 s of pure idle, lives stayed 3 and level stayed 1;
the two-death-trigger enumeration (§2.5) touches neither death site on the erosion path. Instead,
mountain-gone routes to the level-**ADVANCE** path. `[seen]`/`[code]`

- **Erosion** `loc_241c` (main-loop step 4) + seed `loc_23e8`: `[seen]`/`[code]`
  - `loc_23e8` sets erosion pointer `MOUNTAIN_ERODE_PTR 0x8065 = 0x9104` and countdown
    `MOUNTAIN_ERODE_TIMER 0x8067 = diffBase(0x804f) − 4×level(0x8028)` — **erosion runs faster every
    level**.
  - `loc_241c` bails until phase `0x8010 ≥ 0x0a`, then each expiry walks the pointer down the mountain
    column writing tile `0x31`, advancing `0x8065` by `0x20` until the `0x92a4`/`0x93c0` boundary — the
    mountain visibly eating away. In **pure idle** the pointer merely oscillates (no net progress) — it
    animates but never fully erodes on its own. `[seen]`
  - **When the mountain is gone** `loc_241c` reads `boardEndPhase 0x807b`: `[seen]`/`[code]`
    - `0x807b == 0` (pure-idle) → `loc_24c7`: sets `0x807b = 2`, plays the mountain-gone sound
      (`loc_4c6b`, §2.14), and **does nothing else** — no life, no ship drop.
    - `0x807b == 1` (the **ESCAPE** case — set by `loc_1a02` at the top rung, §2.11) → forces
      `shipY 0x810d = 0x16` (ship descends) then `loc_24c7` sets `0x807b = 2`.
    - `0x807b ≥ 2` → `ret`.
  - The ship-landing actor **`loc_384a`** then flies the ship in (X advances to `0x24`, Y falls) and,
    when it lands (Y == 0x17, X ≥ 0x24), clears `0x8079`/`0x8068`, **sets `postTransitionMode 0x807d =
    1`**, and (once Y reaches 0) arms `transitionTimer 0x807c = 0x78`. On expiry `loc_13c9` sees
    `0x807d = 1` → `loc_02fd` → **level++** (§2.11). Lives never change. `[seen]`/`[code]` (grounding-1
    A.4: ship descends X 0x00→0x24 / Y 0x16→0x17; `loc_384a` sets `0x807d=1`,`0x807c=0x78`; on expiry
    → `0x02fd` → **level `0x8028` 1→2 (~f1460)** → full board rebuild, lives held 3 the whole time).

The saucer/tank at the top of the screen are **scenery** (§2.9); erosion is the mechanic they
dramatize, but with no countdown clock and no ship-kill it exerts no life penalty. `[seen]`

### 2.8 The chamber creature & the Pit sliding-floor reveal (`loc_2f71`)

**★ Identity overturn.** `loc_2f71` drives sprite **slot 3** (record `0x822c`) off the counter block
`0x80db`–`0x80e0`. An A/B this pass — perturbing slot-3's source cells `0x80db`–`0x80de` — changed the
**left-chamber creature**, while the top-right labeled "ZONKER" tank (baked scenery, §2.9) was
unchanged. So this object is the **left-CHAMBER creature**, NOT the "Zonker tank." Its canonical
identity (caged specimen / decorative monster) is `[guess]`; its mechanism is `[seen]`/`[code]`. This
doc names `0x80db`–`0x80de` **`CHAMBER_CREATURE_*`** and `loc_2f71` **`advanceChamberCreature`**
(`ram.js` and the idiomatic routines now carry these names — the rename is complete).

`loc_2f71` has a **dual role**, both now `[seen]`:

- **(a) Always-on: animate + publish the creature sprite.** `[code]`/`[seen]`
  - Horizontal bob: `CHAMBER_CREATURE_X 0x80db += velocity 0x80df`, bouncing in `[0x19, 0x38)`
    (velocity flips to `−1` at `x≥0x38`, `+1` at `x<0x19`); the observed on-screen range is ~[0x18,
    0x34] after the `0x8051` bias.
  - Vertical drop: `CHAMBER_CREATURE_FALL_Y 0x80de += an accelerating step 0x80e0`; at `y ≥ 0x86` it clamps
    `y=0x86`, re-rolls the RNG (`loc_4b1a`), resets the step, and starts falling again — i.e. the
    creature repeatedly **drops and resets**. **`0x80de` is the creature's OWN falling-Y — there is NO
    separate "shell."** (The prior "tank lobbing a shell" reading was the same one object.)
  - Sprite frame `0x80dc` toggles `0x38/0x39` every 8 frames; publish writes the 4-byte record `0x822c`
    (byte0 `= x − 0x8051 bias`, byte1 frame, byte2 attr, byte3 `= y + 0x8051 bias`).
  - Then `jp 0x312d` — the actor tail-chain continues into enemies 1&2 (§2.1).
- **(b) Stage-1 (gated on goal-zone latch `0x80e7`): the Pit sliding-floor REVEAL.** `[code]`/`[seen]`
  Once the goal-zone latch `0x80e7 != 0` is set, a 6-tile bar in column 12 dissolves top-to-bottom,
  paced by the reveal gate `0x80e5` (period `0x80e4`, level-scaled): each expiry of `0x80e5` copies 6
  bytes from ROM table `0x3048 + cursor 0x80e6` up a VRAM column at `0x938c` (tiles progress
  `0x36→0x37→0x38→0x39→0x27`), stepping the cursor back 6 per reveal until it underflows (~130 frames).
  The extra condition `PIT_CROSS_ACTIVE 0x8077 != 0` **and** player column `0x806b == 0x6b` gates only
  the one-shot **reveal sound**, not the dissolve. The dispatcher `loc_13de` reads `0x80e6 == 0` as the
  reveal-finished gate. `[code]`/`[seen]`

**Resolved:** the old "sliding-floor tile-animation + the monster beneath it" open item is this ONE
routine — the "sliding floor" is stage (b) and the "monster" is the stage-(a) chamber-creature sprite.

### 2.9 Enemy-3 / the ship / the board intro (one slot, triple use)

`0x810a` is a **2-sprite actor** (primary `0x810a`–`0x8112`, twin `0x811b`–`0x8123`; sprite slots
6&7), init'd by `loc_36fe` and stepped by `loc_3748`/`0x3a4c`/`0x384a`/`0x3a13`/`0x38c8`/`0x3984`.
Grounding (G.17) confirmed **all three of its jobs** on one slot: `[seen]`/`[code]`

- **Intro set-piece:** during the low-phase intro this actor flies the **saucer (top-left) and the
  "ZONKER" tank (top-right)** into place, which are then **baked into the background tilemap and the
  sprite freed.** Both are visible as baked scenery in the live frames. **This baked top-right tank is
  the only thing the word "Zonker" refers to** (the live slot-3 object is the chamber creature, §2.8).
  `[seen]`
- **Live enemy-3:** during live play (`0x8010 ≥ 0x0a` → `loc_3a13`) the same slot is a **roaming
  hostile** (X 0xe3→0xd5, Y 0x23→0x33, walk-cycle tiles 0x16/15/14/17), **shootable** like enemies
  1&2 (§2.3, Z-6). `[seen]`
- **Event-ship:** when the mountain is gone in the escape case, the same slot becomes the **descending
  rescue ship** (`loc_384a` → advance, §2.7). `[seen]`

`loc_36fe` seeds it (primary tile `0x2e`, X `0x24`, Y 0, step `0x0100`; twin tile `0x2f`, X `0x34`);
`loc_3748` is phase-keyed on `0x8010` (0–2 move; 3–5 one-shot spawn then move; 6–8 → `0x38c8`; 9 →
`0x3984`; `≥0x0a` → `0x3a13` live enemy-3; alt `0x807b != 0` → `0x37cf`). `[code]` The phase-6–8 arm
`0x38c8` rebuilds the two-body actor at the start edge and re-stamps its figure; its record mechanics are
exact, but **which specific figure** that rebuild serves is not pinned from code — the sole routine still
tagged `[guess]` in the map (§3). `[code]`/`[guess]`

### 2.10 Jewels, scoring, the ZONK popup, & the board-complete bonus

Collection is handled identically in the horizontal (`loc_18cf`/`loc_1515`), vertical (`loc_1a02`),
and terrain (`loc_1568`) paths, and **all scoring is displayed ×100** (grounding-2 Z-2: the BCD field
`0x8034:0x8031` renders as four digit tiles with fixed trailing zeros; the on-screen readout showed
"SCORE1 6000"). `[seen]`/`[code]`

- **Crystal** — tile `0x3a`: award `0x467b` (`BC=0x0010`, sound `0x10`), bump `CRYSTAL_COUNT 0x8081`,
  blank the cell. **Displayed +1000.** There are **4 crystals** on a board. `[seen]` (Z-3: `0x8081`
  incremented in lockstep with `0x8031` = +0x10 BCD each).
- **Diamond** — tiles `0x3b`/`0x3c`/`0x3d` (**3 diamonds**, one each): gated by prize-gate `0x8076`
  (armed by tile `0x26`); award `0x4683` (`BC=0x0020`), set the **treasure latch `TREASURE_COLLECTED
  0x8078` = the tile code**, bump `DIAMOND_COUNT 0x8082`, blank the cell. **Displayed +2000.** The
  latch (`0x8078 != 0` after any diamond) is what the board-completion gate reads (§2.11).
  `[seen]`/`[code]`
- **Enemy kill** — `0x4673` (via `loc_31d0`), `BC=0x0001` → **+100 displayed** (not +200).
  `[seen]` (Z-2 scale + Z-6 live +1/kill on enemy-3).
- **Cross the Pit / reboard — NO separate award.** The pit-cross awards **zero** (Z-5). The only board
  reward is the completion bonus below. `[seen]`
- **★ The "ZONK!!" popup** `loc_2d6b` (reached from `loc_2cb7`'s `jp z,0x2d6b` when the dig countdown
  `0x80b1` hits the `0x40` reload sentinel): it stamps a **fixed 5-tile glyph** — tile codes
  `0x23,0x18,0x17,0x14,0x3e` at offsets +0x3f/+0x1f/−0x01/−0x21/−0x41 from the object pointer `0x806e`
  — which **decode to "ZONK" + a "!!" tile**, painted in a 5-cell colour-`0x06` (red) column. It is a
  gag/impact popup, **not** a "treasure-reveal glyph." Its functional side-effects are exact:
  **`TREASURE_COLLECTED 0x8078 = 0`** (reset) and **`transitionTimer 0x807c = 0xb4`** (armed). `[seen]`
  (glyph decoded this pass) / `[code]` (tile codes + side-effects exact).
- **★ Board-complete BONUS** — `loc_3bec`, called by `loc_02fd` (the level-advance routine), so it runs
  at **board-complete only**. It is a **BONUS, not a completion requirement** (§2.11): `[seen]`/`[code]`
  ```
  count 0x800a = 5 + 5·(CRYSTAL_COUNT 0x8081 == 0x04) + 5·(DIAMOND_COUNT 0x8082 == 0x03)  → {5, 10, 15}
  ```
  The count selects one of **three text messages** (ROM rows `0x4a14/0x4a21/0x4a2e` and
  `0x4a3b/0x4a48/0x4a55`, keyed by 5/10/15) and then loops `count` times adding `BC=0x0010` (+1000
  displayed) to the score. So the bonus = **count × 1000 = 5000 / 10000 / 15000** — the classic
  no-treasure / all-crystals / full-treasure tiers, NOT a x2/x3 multiplier. **Observed** (Z-4:
  crys=4, diam=3 → `0x800a=0x0f`, score ramped +15000).
- **Score storage:** `SCORE_LO/HI 0x8031/0x8034` (BCD), per-player mirror `0x8032/0x8035` (P1),
  `0x8033/0x8036` (P2, via `loc_4632`, §2.5). `[code]`

### 2.11 Board flow & progression — the master transition + completion gate

**One gate** in the player dispatcher `loc_13c9` routes both "lose a life" and "advance a level." Each
frame it counts `transitionTimer 0x807c` down; **on expiry it reads `postTransitionMode 0x807d`:**
`[seen]`/`[code]`
- **`0x807d == 0`** → `jp 0x0278` → **decrement lives `0x802b`** → death / retry (fresh-board reset).
- **`0x807d == 1`** → `jp 0x02fd` → **increment level `0x8028`** → advance: runs the `loc_3bec` bonus
  then rebuilds the board (`loc_031a`).

**Grounded directly** (`tape_transition`, poke @f1250, timer=8): with `0x807d=1` the countdown drove
**level `0x8028` 1→2 @f1256** (lives held 3); with `0x807d=0` the same countdown drove **lives 3→2**
(level held 1). `[seen]`

**★ How a board COMPLETES (the completion gate).** In the vertical/climb routine `loc_1a02`, when the
player reaches the **top rung** (climb-column `0x806b == 0x23`) **AND the treasure latch
`TREASURE_COLLECTED 0x8078 != 0`** (≥1 diamond grabbed), it latches **`boardEndPhase 0x807b = 1`**.
That drives the escape chain: `loc_241c` drops the rescue ship (§2.7) → `loc_384a` sets `0x807d = 1` →
`loc_02fd` → **level++**. If `0x8078 == 0` at the top rung, `loc_1a02` bails (no completion).
`[seen]`/`[code]`

**None of this reads the collection counts.** The `CRYSTAL_COUNT == 4` / `DIAMOND_COUNT == 3`
thresholds feed ONLY the `loc_3bec` bonus tier (§2.10) — a completion **bonus**, never the completion
**trigger.** `[seen]`: the level advances 1→2 **identically** at counts 0+0, 1+1, and 4+3 (the
`ab_zero`/`ab_partial`/`ab_full` A/B logs — all `0x807d=1`, all reach level 2 @f1256); attract
completes at crys=0/diam=1; and pinning `0x8078 = 0` blocks every escape. (This corrects the prior
"6 diamonds / crys=4&diam=3 threshold" reading, which conflated the bonus tier with the trigger.)

`0x807d` is set to 1 (advance) by the escape/reboard actors (`loc_384a`, and the pit-cross `loc_19d0/
19e3` path on a real reboard) and left/forced 0 (death) by the enemy-catch and bare-timer paths.
`[seen]`/`[code]`

- **Board-complete → level++ → fresh board → faster** (grounding-1 B.5): forcing the advance gives
  level 1→2, a full rebuild (phase re-ramps; player respawns from top; ~765 cells redrawn), and
  difficulty scales — enemy speed pair 7→5, `frameDelay 0x8011` 9→8, erosion base faster.
  `[seen]`/`[code]`
- **★ The level-10 slow-motion cliff.** `frameDelay 0x8011 = speedBase(0x0a) − level`. **At level 10 it
  hits 0**, which wraps the `loc_0348` busy-delay (`ld b,0x00` → 256 inner spins × the outer count) to
  256 passes (~849k cyc), throttling the whole main loop (player/enemies/laser/erosion) ~17× to ~3.6
  effective FPS **while the 60 Hz NMI timers keep running** — the difficulty ramp meant to peak at L10
  inverts into a degenerate crawl. `[seen]` (`frameDelay = 0x01` at L9 vs `0x00` at L10 — `exp3b_9`
  vs `exp3b_10`; the RNG stepped ~160× per window at L9 vs ~2× at L10). **Higher levels sawtooth:** at
  L16, `frameDelay = 0x0a − 0x10 = 0xfa (250)` — a huge delay again (`exp3_lvl_16`).
- **Two boulder layouts by `level 0x8028` bit 0** (grounding-1 B.7): level-1 (bit0=1) vs level-2
  (bit0=0) boards differ in 60/66 dirt-field cells, vs 4 for a level-1 self-comparison — two distinct
  layouts alternating by bit 0. Board LAYOUT variety is capped at `min(level+1, 4)` types. `[seen]`/`[code]`
- **Board setup:** `loc_2f2f → loc_30de → loc_36fe` seed enemies, the chamber creature, and the
  per-level difficulty; the intro ramps `0x8010` 0→`≥0x0a`, flying the set-pieces in before live play.
  `[seen]`/`[code]`

### 2.12 High-score / initials entry

A full subsystem, grounded end-to-end this pass. `[seen]`/`[code]`
- **Game-over gate:** working lives `0x802b` → 0 (per-player mirror via `loc_4632` → `0x802c`/`0x802d`,
  §2.5).
- **`loc_4d3a`** inserts the candidate score (`0x8034:0x8031`, big-endian) into the descending
  three-entry high-score table (5-byte records: 3 initials + 16-bit value at `0x8039`/`0x803e`/`0x8043`
  — value slots `0x803c`/`0x8041`/`0x8046`), shifting lower ranks (value + initials) down, stamping the
  freed initials `0xFF`, and setting the **landed rank `0x8048`** (1/2/3, or 0 = no placement). The
  default table is all-zero, so any score places. `[seen]`/`[code]`
- **`loc_4df8`** renders the reward screen — **"CONGRATULATIONS PLAYER n / YOU HAVE EARNED THE GREATEST
  SCORE / RECORD YOUR INITIALS"** — and seeds `INITIALS_REMAINING 0x804b = 3`. `[seen]`/`[code]`
- **`loc_4eea`** is the per-frame initials-entry handler on input `0x8018`: bit0/bit2 step the current
  letter DOWN, bit1/bit3 step it UP (the letter tile-code `C` wraps 0x09..0x23), and **bit4 (Fire)
  commits** — it stamps the letter, moves the cursor up one row, decrements `0x804b`, and re-arms a
  20-frame vblank delay. Entry ends when `0x804b` reaches 0. `[seen]`/`[code]`

### 2.13 Rendering

- **Tilemap** in VRAM at **`0x9000`** (0x20-wide rows). The display is rotated: **ROT270 is the correct
  upright player view** (ROT90 comes out upside-down). Digging, carving, jewel-blanking, hazard-
  painting, erosion (`0x31`), the ZONK glyph, and the set-piece bake all write here. `[seen]`/`[code]`
- **Sprite records (8 slots, 4 bytes each; `0x8220`–`0x823f`, LDIR'd to sprite RAM `0x9840` by the
  NMI):** `[seen]`/`[code]`
  - slot 0 `0x8220` player · slot 1 `0x8224` reaction/laser · **slot 2 `0x8228` falling-hazard**
    (§2.6) · **slot 3 `0x822c` chamber creature** (§2.8) · slot 4 `0x8230` enemy 1 · slot 5 `0x8234`
    enemy 2 · slot 6 `0x8238` enemy-3 body · slot 7 `0x823c` enemy-3 twin.
  - `boards/thepit/video.js` decodes each record: byte0 → screen position, byte1 → `code&0x3f` +
    flipX(0x40)/flipY(0x80), **byte2 → `color = (byte2 & 7)*4` + priority bit3**, byte3 → the other
    axis. Under ROT270: **record byte0 = screen-HORIZONTAL, byte3 = screen-VERTICAL** (byte0 = work-Y
    `0x8068`, byte3 = work-X `0x806b`; dig-mode moves the player DOWN while work-X increases → work-X =
    screen-vertical). `[seen]` (grounding-2 Z-8).
- **★ Cocktail / flip — the real value is `0x02`, not `0x40`.** The 180° flip is the hardware LS259
  flipscreen: `loc_4b55` computes `flipBit = ((activePlayer 0x8002 − 1) & cocktailDSW_bit5 0x8052) ^
  flipDSW_bit4 0x8050`, writes it to **LS259 `0xb006` (b6 = flipX + input-mux) and `0xb007` (b7 =
  flipY)**, and sets **`SPRITE_COORD_BIAS 0x8051 = flipBit << 1`.** So the true cocktail value of
  `0x8051` is **`0x02`** — a +2 sprite-Y nudge folded into every sprite record's screen-VERTICAL byte
  (byte3) plus the player's byte0 — NOT the flip itself, and NOT the arbitrary `0x40` a prior round
  poked to probe the axis. `[seen]`/`[code]` (Z-8 established the axis by poking; `loc_4b55` gives the
  value.)
- **Colour** RAM / draw scratch: `0x8055`–`0x8060` (`PLOT_RUN_LENGTH`, fill byte, `TILE_COL/ROW`,
  `TILEMAP_OFFSET`, `GLITTER_COUNTDOWN`, CRAM/VRAM cursors). `[code]`

### 2.14 Sound

- **Queue:** the enqueue stubs `loc_4c57..0x4ca3` each load a distinct command index into A and fall
  into the shared tail **`loc_4ca5`**, which does **`or 0x80`** (sets bit 7) and appends the byte to the
  8-slot ring at `SOUND_RING 0x8020` (write index `SOUND_HEAD 0x801e`). The NMI consumer (`loc_0066`)
  dequeues one slot per frame and writes it to the hardware latch `0xb800` **only if bit 7 is set** —
  which is why an index that reaches the ring **without** bit 7 (ids `0x00–0x1F`) **never sounds.**
  So the hardware always receives `sfxId | 0x80`. `[code]` (Note: `loc_4c6b` is the **enqueue-stub
  ADDRESS** for sfx id `0x07` → hardware byte `0x87`; it is not itself a "sfx id".)
- **Grounded command → event map (`[seen]`, hardware bytes):** coin `0x83` · start `0x84` ·
  board-start/advance `0x86` · **mountain-gone `0x87`** (id `0x07`, `loc_4c6b`) · jewel-collect
  flourish `0x90`/`0x92`/`0x91` · dig-descend `0x93` · dig-carve `0x94` (the pre-OR dig/carve id is
  `0x14`, requested by `loc_4c9f`; the crystal-collect id is `0x10`, treasure-capture `0x11`).
- **Still `[guess]`:** laser, boom, and enemy-death sounds (no audio oracle — handle by ear); two
  continuous ambient tones `0x89`/`0x8F` can't be pinned.

---

## 3. STILL-OPEN (genuinely unresolved)

The nine-agent completeness pass closed the completion gate, the level-loop economy, the level-10
slow-motion cliff, the enemy-speed periodicity, the cocktail-flip value, the falling-hazard render
split, the high-score subsystem, the ZONK popup, the two-death-trigger enumeration, and the identity
of both the chamber creature and the Pit sliding-floor reveal. Only these remain: `[guess]` unless noted.

1. **The chamber creature's canonical identity** — `loc_2f71`'s slot-3 sprite is grounded as a live
   left-chamber creature that bobs and drops (§2.8, `[seen]`), but whether it is a caged specimen, a
   decorative monster, or an alien is not determinable from code. `[guess]` on the *identity* only.
2. **Isolated laser / boom / enemy-death sounds** — no audio oracle exists; only the command→event map
   with clear visual correlates is `[seen]` (§2.14). These arms and the two ambient tones stay `[guess]`.
3. **A live falling arrow-rain descent on-screen** — the arrow type, seed, physics, and render split are
   grounded in code (§2.6). **PROPOSER-ONLY `[seen]` — NOT yet confirmed (owed an independent
   re-derivation).** On 2026-07-31 one agent poked a live hazard mid-game under MAME
   (`HAZARD_STATE 0x80aa=0x10`, `HAZARD_TYPE 0x80ab=0x07`, `HAZARD_ACTIVE_COUNT 0x80bd=1`, a descending
   `HAZARD_Y 0x80ac`); the game's own composer (`loc_2bd3`) emitted the sprite record
   `[SHAPE 0x10, COLOUR 0x07]`, and captured frames showed that sprite descending on-screen at the
   position the hardware decode predicts (`y=240−spr[+0]`, `x=spr[+3]+1`; the poked `HAZARD_Y` drives
   raster-x = screen-vertical under ROT90). **But the same agent proposed AND observed this, and its
   review only checked the write-up (could not re-run MAME) — so it does not clear proposer≠confirmer**
   (docs/understanding.md "Maintain it as understanding grows"). Until a SEPARATE agent independently
   re-derives it, treat the render+descent as an observed proposal, not a confirmed `[seen]`. Caveats
   also unresolved: the sprite is small/dirt-occluded so the exact glyph isn't crisply legible, and
   this was a poked hazard, not a naturally-triggered rain in the bottom chamber (that spawn stays `[code]`).
4. **The two-body actor's per-arm figure attribution** — the enemy-3 / rescue-ship / intro-set-piece
   slot's rebuild-at-edge routine (`0x38c8`, §2.9) has exact record mechanics, but WHICH specific figure
   its redraw serves is not determinable from code. The slot's three observed roles (§2.9) are `[seen]`;
   only this internal attribution stays `[guess]` — it is the sole routine still tagged `[guess]` in the
   `ram.js` routine map.

Everything else previously tagged `[guess]` or mis-identified has been promoted (`[seen]`/`[code]`) or
overturned above.
