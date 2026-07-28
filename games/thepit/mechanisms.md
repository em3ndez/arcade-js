# The Pit (`thepitu1`) — MECHANISMS

**The inside-out game model, measured against the current code.** This is the authoritative
map of how The Pit actually works, built from the decompiled routines, the named RAM map,
the board (hardware/render) layer, and the MAME-0.288 grounding in
`docs/PIT-CLARIFY-LEARNINGS.md`. Where the public-research frame in
[`gameplay.md`](./gameplay.md) agrees, it is confirmed; where they diverge, the code and the
grounded observation win and the disagreement is called out under
[§2 Public lore vs. grounded reality](#2-public-lore-vs-grounded-reality).

**Measured counts** (counted from the current tree, not carried over):

| What | Count | How measured |
|---|---|---|
| Routines decompiled | **169** | `idiomatic/*.js` minus `ram.js` |
| Routines with an earned English name | **169** | every file; **0** `loc_`-named files remain |
| RAM cells named | **141** | `export const` lines in `idiomatic/ram.js` |

**Ground truth for meaning is MAME 0.288**, observed by playing the real ROM. The idiomatic
layer is memory-equivalent to the frozen `translated/` oracle (per-routine equivalence gates);
the correctness authority is the pixel gate, never a RAM name — a wrong name is worse than a
neutral hex address. Names carry a confidence tag; see [§4](#4-confidence-conventions).

---

## 1. The game model

**You are the digger** — a small one-man explorer rendered from two stacked 16-pixel sprites
(hardware sprite slots 0+1). `[seen]` The screen is a vertical (ROT90) shaft: a shallow
surface band at the top, a deep field of diggable dirt below.

**The objective, end to end** (grounded in a natural, no-poke MAME run):

1. **Dig down** into the pit. You carve through diggable terrain by *walking into it* — there
   is no separate "dig" verb beyond holding the action button and moving; movement into a
   dirt cell arms a carve reaction that replaces the cell with its dug form. `[seen][code]`
2. **Cross the feature tile `0x26`.** Passing over it sets `FEATURE_TILE_LATCH` (0x8076) — the
   prerequisite that *unlocks* diamond pickup. Until it is set, the collector refuses the
   diamonds, so a "drive straight through the diamonds" run collects nothing. `[seen]`
3. **Collect the diamonds — loot tiles 59–61, +20 each.** The first +20 pickup sets
   `DIAMOND_COLLECTED` (0x8078); this is the completion gate. The +10 "dirt-gems" (tile 58) do
   **not** set it. `[seen][code]`
4. **Climb back up and surface at the top rung.** When the digger reaches the top rung
   (`OBJ_Y` == `0x23`) with `DIAMOND_COLLECTED` set, `stepObjectAndResolveTile` writes
   `SPAWN_PHASE` = 1 — the observed **level-complete** trigger. The two-sprite completion actor
   fires and `advanceToNextLevel` bumps `LEVEL`; the same fixed board (mode 160) is rebuilt
   one difficulty step harder. A/B proven: gate set → clears; gate clear → never clears. `[seen]`

**Win = surface at the top rung with a diamond in hand.** It is emphatically **not**
collect-all-loot and **not** the goal tile — those are separate systems (bonus tiers and the
scroll-reveal crossing; see §3.4 and §3.5). `[seen]`

**Lose = get touched.** The maze enemies kill on contact. When an enemy mover's box overlaps
the digger's box (`handleObjectBoxOverlap` inside `stepEnemyMover`), it snaps onto the digger,
arms the **capture/death pose sprite `0x35`** (decimal 53) and a dwell countdown, plays the
capture sound, and hands to `tickObjectDwellThenTransition`; when that expires the round
boundary docks a man (`dockManAndDispatchRoundBoundary`: `MEN_LEFT`--). `MEN_LEFT` → 0 →
game-over teardown → high-score offer → attract. `[seen][code]`

**The cast** (sprite slot ↔ RAM entity, 100% match in both attract and gameplay observation):

| On screen | Sprite slot(s) | RAM | Role |
|---|---|---|---|
| **The digger** (player, a little man) | 0 + 1 | tracked object `OBJ_X`/`OBJ_Y` | You. Two 16px halves = one ~32px tall man. `[seen]` |
| **Background spider** | 3 | `BG_SPRITE_*` (0x80db–0x80de) | A small left-chamber spider that bounces/falls decoratively. **Not** a UFO. `[seen]` |
| **Claw-creature OBJ1** | 4 | `OBJ1_*` (0x80e8…) | Pink claw-creature; normally parked clipped just above the top edge. `[seen]` |
| **Claw-creature OBJ2** | 5 | `OBJ2_*` (0x80f9…) | The same pink claw-creature, visible in the maze. `[seen]` |
| **The saucer** (two-sprite actor) | 6 + 7 | actor `0x810a` + twin `0x811b` | A flying saucer that descends, then continues solo as a maze creature. **Dual-role: also the completion actor.** Kills on contact via the *same* shared collision driver as the claw-creatures. `[seen]` |

All three enemy kinds — OBJ1, OBJ2, and the saucer — kill through the one shared
`stepEnemyMover` / `handleObjectBoxOverlap` path (positive test + negative control both
confirmed). `[seen]`

---

## 2. Public lore vs. grounded reality

`gameplay.md` is the outside-in public record. It gets the premise right (dig down, grab a
jewel, climb out) but three specifics are wrong or unsupported once measured against the code
and the MAME grounding. **Code + grounding win.**

### 2a. The ZONKER is decorative, not a tank that destroys your ship
Public lore (Wikipedia/Centuri): a **tank called the "Zonker"** sits up top and slowly shoots
away a mountain by your ship; dawdle and it **destroys your ship, costing a life** — the game's
timer. **Refuted.** Grounding: the "ZONKER" banner, the top-left "UFO" dock graphic, and the
entire bottom-band "creatures" are **decorative tilemap, not sprites** — no active enemy, no
ship-destroying actor. The real enemies are the maze movers (OBJ1/OBJ2/saucer). `[seen]`
There *is* a DSW **"Time Limit" (Long/Short)** bit in the driver `[code]`, so a pacing pressure
exists as a setting, but it is not the sprite-tank the lore describes; how a time limit
manifests in play is not separately grounded — **open item**.

### 2b. There is no horizontal laser — the "fire button" is the DIG button
Public lore: a **single button fires a horizontal laser** to disintegrate enemies. **Refuted
by the code.** The MAME driver (`taito/roundup.cpp`) does define **IN0 bit4 = BUTTON1**, and
the code *does* read it — but never to shoot:

- In gameplay, `advanceReactionObject` reads `IN0 & 0x10` as **dig held**: holding it drives
  the carve object, and while facing left/right it seeds a horizontal **terrain scroll** (the
  crossing mechanic, §3.5). `[code]`
- `stepHighScoreInitialsEntry` reads `0x10` as the **confirm/advance** button in initials
  entry. `[code]`
- `showColourTestScreen` reads UP+BUTTON1 (`0x08`+`0x10`) to step the **diagnostic** screen. `[code]`

The player-movement router (`routeIdleObjectByMoveCommand`) tests **only** the four direction
bits (`0x01`/`0x02`/`0x0c`) and ignores `0x10`. **A repo-wide check of all 169 routines finds
no fire / shoot / laser / projectile / bullet spawn routine of any kind.** (The one code
comment that says "dig/projectile-spawn path" in `flagObjectTargetOverlap` refers to the
**dig-target loot cell** placement, not a weapon.) The player kills nothing; enemies are
**avoided**, never shot; contact kills *you*. The button is a dig/action/confirm button.
**Verdict: the horizontal-laser mechanic does not exist in this ROM.** `[code]`

### 2c. "Cross the Pit / retractable floor / arrows" ≈ the goal-tile scroll-reveal
Public lore frames the return trip as crossing a room with a sliding/retractable floor while
arrows rain down. In the code this maps onto the **goal tile `0x27`** system: crossing it
latches `GOAL_TILE_LATCH`/`GOAL_CROSSING_LATCH` and triggers an **auto-walk plus a progressive
terrain scroll-reveal** (`REVEAL_CURSOR` counts down, opening the next pit section). But this
crossing is **separate from and not required for** level completion — the win is surfacing with
a diamond (§1). The "retractable floor / arrows" flavor has no distinct code entity beyond the
scroll-reveal and the diamond chamber. `[seen][code]`

### Where lore and code agree
Dig down; grab a jewel to escape; **8-way** joystick (the driver's `PORT_8WAY` settles the
public "4-way vs 8-way" conflict → 8-way); one action button; digging is slower/precise
(cell-boundary aligned carve); **one level that just gets faster** (layout is level-independent,
only difficulty scales); bonus grows with a fuller jewel collection (SINGLE/DOUBLE/TRIPLE);
Z80 + AY-3-8910 on rotated 256×224 hardware. `[seen][code]`

---

## 3. Subsystems

### 3.1 Input, coin, start
Two input ports, both debounced once per frame by the vblank NMI (`serviceVblankNmi`), which
double-samples each port and latches the stable value; game logic reads the debounced RAM cell,
never the raw port. `[code]`

- **IN0** (`0xA000`, active-low, complemented in `io.readIn0` to the active-high form the ROM
  uses) → `IN0_DEBOUNCED` (0x8018): bit0 LEFT, bit1 RIGHT, bit2 DOWN, bit3 UP (8-way), **bit4
  BUTTON1** (dig/action/confirm). `[code]`
- **IN1** (`0xA800`, active-high) → `IN1_DEBOUNCED` (0x8015): bit0 COIN1, bit1 START2, bit2
  START1. `[code]`
- **IN2** is the cocktail 2P mux twin of IN0; LS259 control-latch **bit6** selects IN0 (upright)
  vs IN2 (cocktail) and is also flip-X. `[code]`
- **DSW**: coinage (b0–1), Game Speed Fast/Slow (b2), Time Limit Long/Short (b3), Flip Screen
  (b4), Cabinet upright/cocktail (b5), Lives 3/4 (b6), Diagnostic tests (b7). Decoded once by
  `applyDipSwitches` into `COINS_PER_CREDIT_A/B`, `LOOP_DELAY_BASE`, `STARTING_MEN`,
  `SPRITE_COORD_BIAS`. `[code]`

Coin/credit is a small edge-detect machine: `COIN_SW_ACCUM`/`START1_SW_ACCUM`/`START2_SW_ACCUM`
(0x8003–0x8005) are pulse accumulators; a completed pulse banks a credit into `CREDIT_COUNT`
(0x8000, clamped 9) mirrored to `CREDIT_MIRROR_A/B` (0x801c/0x812c) that the NMI corruption
watchdog cross-checks (a mismatch cold-boots). `rearmMachineAndBranchOnCredits` forks on
credits to show the credit screen; a START pulse pays a credit and runs **`startGame`**, which
clears state, decodes the DSW, seeds `LEVEL`=1 and `MEN_LEFT` from `STARTING_MEN`, primes both
players' saved records, loads the starting player's record, and falls into the round loop.
`GAME_MODE` (0x8001) doubles as player-count/mode: **1 = 1-player, 2 = 2-player, ≥3 = attract
demo**. `[code]`

### 3.2 The core loop: dig, collect, surface
The digger is "the tracked object" the collision/tile code locates through `OBJ_X`
(screen-horizontal, drives the tilemap **row**) and `OBJ_Y` (screen-vertical, drives the
**column**) — the ROT90 sprite-format swap and the display rotation cancel, so `_X`/`_Y` read
as screen axes. `[seen]`

Per frame the object/state dispatcher runs: `dispatchObjectFrameByStateTimer` (holds the object
in a timed state while `STATE_TIMER` is nonzero) → `advanceTrackedObject`, which walks a chain
of control gates (busy-this-frame, `OBJECT_ACTIVE` presence, `SPAWN_PHASE`, dig-arm state,
motion marker, `GOAL_TILE_LATCH`, `GOAL_CROSSING_LATCH`, `REVEAL_CURSOR`) and hands the frame to
exactly one handler. In ordinary play that handler is **`stepObjectFromControl`**: unless a
reaction animation owns the object, it picks the move command — the attract demo's synthetic
one-hot `DEMO_STEER_DIR` when `GAME_MODE` ≥ 3, otherwise the debounced joystick — and passes it
to `advanceObjectFrame` → `routeIdleObjectByMoveCommand`, which routes on the four direction
bits (0x01/0x02/0x0c). `[code]`

**`stepObjectAndResolveTile`** is the heart of dig-and-collect. Each frame it computes the
map cell under the object and, on a cell boundary:

- Top-rung column (`OBJ_Y`==`0x23`): if `DIAMOND_COLLECTED` set → `SPAWN_PHASE`=1 (**win**),
  else defer. `[seen][code]`
- Tile **58** → `awardTenPoints`, bump `LOOT_10PT_COUNT`, blank the cell, keep moving. `[code]`
- Tiles **59–61** → record the code in `DIAMOND_COLLECTED`, `awardTwentyPoints`, bump
  `LOOT_20PT_COUNT`, blank the cell. `[code]`
- Solid tiles (42/65/193, band 149–153) → block (defer, no move); a phase-gated band
  (197, 154–157) blocks unless the sub-cell phase bit is set; tiles ≥ the diggable-high bound
  are passable. `[code]`
- **Diggable band (113–157):** compare the cell against the ROM's expected-terrain table for
  this sub-cell; a mismatch means fresh terrain → arm the **carve reaction** (`REACTION_STATE` =
  carve, `REACTION_TIMER` from `REACTION_PERIOD`, carve sprite `0xf6`). `[code]`

The carve reaction is then driven by the reaction state machine (`REACTION_STATE` 0x80a2 = idle
/ 1–4 armed) via `advanceReactionObject` / `triggerDigReaction` / the dig-object family
(`spawnDigEntity` → `commitDigEntity`, `advanceDigCarveObject`, `advanceDigTarget`,
`captureTargetOnOverlap`, `landDigTarget`, `spawnPendingDigObject` popping the 24-slot
`DIG_SPAWN_QUEUE`). The feature/diamond gating: crossing tile `0x26` sets `FEATURE_TILE_LATCH`
(0x8076); the collect handlers (`collectLootTile`, `resolveActorTerrainStep`,
`collectAlignedLootElseResolveTile`) check it before allowing a +20; the first +20 sets the
one-shot `DIAMOND_COLLECTED`, after which those tiles always score. `[seen][code]`

> **Honest caveat (from `ram.js`):** the *same physical byte* 0x8078 (`DIAMOND_COLLECTED`) is
> also read by the dig driver and the twin-actor advance, and cleared by the dig glyph stamp.
> Whether those are true couplings or byte-reuse is **unproven** — do not assert a coupling.
> `[guess]`

### 3.3 Enemies: the movers, the saucer, and death-on-contact
There are two structurally identical maze-mover records — **OBJ1** (0x80e8, ~17 bytes:
X/sprite/attr/timer/state/move-period/target-col) and **OBJ2** (0x80f9), plus a working mover
block (`MOVER_*` at 0x8090…). `advanceObjectMovers` drives OBJ1, `advanceObjectMover2` drives
OBJ2, both through the shared **`stepEnemyMover`** (0x319d): arrival / capture / retarget /
patrol steering. Steering derives a tilemap probe cell + sub-tile phase from the mover's pixel
position (`decodePositionAndSteer`), consults phase-keyed ROM tile tables
(`tileInProbeRow`, `nextTileInProbeRow`, `probeRowAheadTilePair`, `probeRowBackTilePair`) and
picks a direction preset (`stepMoverUp`/`stepMoverDown`/`stepMoverMirrored`/`stepMoverUnmirrored`,
publishing `MOVER_DIRECTION`). A dormant mover just ticks its cadence counters
(`advanceDormantMover`); `MOVER_STATE`'s sign selects dormant-tick vs armed vs player-box branch.
`[code]`

The **saucer** is a two-sprite actor (`advanceTwoSpriteActor`): a primary body at 0x810a plus a
rigid `+16px` **twin** at 0x811b, advanced together (`easeActorToRest` writes primary+16 into the
twin every step) and staged by `stageActorSpriteRecords` into sprite slots 6/7. It is seeded /
spawned by `seedActorSpawnState` / `spawnAltPhaseActor` / `spawnTwinActor` /
`advanceOrRebuildTwinActor`, paced by `paceActorCadence`, and marched by `advanceAltPhaseActor` /
`advanceActorMovers`. It descends, then patrols as a maze creature — and it is *also* the
**completion actor** that fires when `SPAWN_PHASE` is set. `[seen][code]`

**Death:** any mover (OBJ1/OBJ2/saucer) whose box overlaps the digger's runs
`handleObjectBoxOverlap` → snaps onto the digger, sets sprite `0x35` (death pose) + dwell +
capture sound → `tickObjectDwellThenTransition` blinks it, then the round boundary docks a man.
The same collision driver serves all three, so "is X an enemy?" is answered uniformly. `[seen]`

### 3.4 Scoring and the bonus tiers
Score is 2-byte packed BCD (`SCORE_LO`/`SCORE_HI`). `awardOnePoint`/`awardTenPoints`/
`awardTwentyPoints` wrap `addScore`, which BCD-adds and repaints via `drawScoreDigits` /
`redrawScoreHud` / `unpackScoreDigits` / `renderScoreReadouts`. `[code]`

The **bonus screen** (`showBonusScreen`) picks a tier from two gameplay config bytes:
`count = 5; if LOOT_10PT_COUNT (0x8081)==4 count+=5; if LOOT_20PT_COUNT (0x8082)==3 count+=5` →
**5 / 10 / 15**, which selects the 5000 / 10000 / 15000 ROM label strip and the hold length.
So the full set — **4 ten-point dirt-gems + 3 twenty-point diamonds** — yields TRIPLE (15000);
over-collecting past the exact counts (via pokes) *drops* the tier. Grounding confirms
SINGLE/DOUBLE/TRIPLE = 5000/10000/15000 verbatim. `[seen][code]`

### 3.5 The goal tile and terrain scroll-reveal
Distinct from the diamond win: crossing the **goal tile `0x27`** (once past crossing-column
`0x53`) latches `GOAL_TILE_LATCH` (0x80e7) and its twin `GOAL_CROSSING_LATCH` (0x8077). That
reroutes the dispatcher to auto-walk the object toward the far edge (`advanceActorWalk` /
`drawActorWalkFrame` fire a far-edge one-shot) and enables the **scroll-reveal**: with the dig
button held and the object facing a scroll-capable direction, `advanceReactionObject` seeds a
horizontal terrain scroll; `revealTerrainColumn` / `drawTerrainColumn` step `REVEAL_CURSOR`
(0x80e6) back 6 per reveal (underflow = reveal finished) to open the next pit section, paced by
`REVEAL_GATE`/`REVEAL_PERIOD`, with the column-reveal animation in `advanceColumnAnimation` /
`reseedColumnAnimation`. Retreating below the crossing column clears the latch. Not required to
complete the level. `[seen][code]`

### 3.6 Level and difficulty scaling
**Layout is level-independent** — every level rebuilds the *same* fixed board (`setupBoardDisplay`
with `NEXT_LEVEL_BOARD_MODE` = **160**), same 3 diamonds + 4 dirt-gems + geometry. Only
**difficulty** scales, and it is latched per-round at setup (poking `LEVEL` mid-round does not
retro-change the seeded knobs). `advanceToNextLevel` does `LEVEL`++ then rebuilds board 160.
`[seen][code]` The difficulty formulas, **read from the current code** (correcting stale
folklore):

| Cell | Formula | Source | Range as LEVEL climbs |
|---|---|---|---|
| `REVEAL_PERIOD` (0x80e4) | `7 − min(LEVEL+1, 4)` | `seedBackgroundAnimParams.js:73–74` | 6 → 5 → 4 → floor **3** |
| `OBJ1_MOVE_PERIOD` (0x80f6) | `7 − (LEVEL & 6)` | `seedObjectRecords.js:77` | faster mover cadence |
| `MAIN_LOOP_DELAY` (0x8011) | `LOOP_DELAY_BASE − LEVEL` | `initRoundAndEnterMainLoop.js:76` | shorter per-frame busy-wait |
| step timer (0x8067) | `STEP_TIMER_BASE (0x804f) − 4·LEVEL` | `reseedColumnAnimation` | faster column steps |

> **Correction:** `REVEAL_PERIOD` is **`7 − min(LEVEL+1, 4)`** (stepping 6→3), **not**
> `LEVEL ^ 0x07`. The `ram.js` doc-comment for 0x80e4 still repeats the old `A^=0x07` reading;
> the executable code in `seedBackgroundAnimParams` is authoritative — trust the code.

### 3.7 Two-player
`GAME_MODE` (0x8001) = player **count** (1 or 2; ≥3 = attract); `GAME_STATE2` (0x8002) = active
**player index**. Each player has a backup record (level/round/score/men) saved by
`saveActivePlayerRecord` and restored by `loadPlayerState`. At a round boundary
`dockManAndDispatchRoundBoundary` docks the active player's man, persists the record, and on the
1-player leg routes by men-in-reserve (next round vs teardown); the 2-player leg runs its own
sub-phase sequencer (`stepRoundSubPhaseAndBranch`) — the P1→P2 handoff and the saved-record swap
were watched end-to-end on a forced death. `[seen][code]`

### 3.8 High score and initials entry
Three-entry descending table (`HIGH_SCORE_TABLE` 0x8039, 5-byte records: 3 initials + 16-bit
score). `submitHighScoresAndReset` / `submitPlayerHighScore` offer each finishing player's score;
`insertHighScore` ranked-inserts a candidate (with 0xFF-initials placeholders) **only if it beats
`table[rank3]`**. `runHighScoreInitialsEntry` builds the "RECORD YOUR INITIALS" screen and
`stepHighScoreInitialsEntry` runs the 3-dial entry (`INITIALS_REMAINING` 0x804b counts 3→0),
reading BUTTON1 to confirm and UP/DOWN to spin (`advanceInitialUp` / `stepInitialDown`).
Grounded gotcha: the default table is seeded to all-zero scores and the insert needs
candidate > `table[rank3]`, so a score of 0 never qualifies — any nonzero score does. `[seen][code]`

### 3.9 Rendering, sprites, background
No i8257 DMA — sprites render straight from sprite RAM. Work-RAM regions (from
`boards/thepit/hardware.json`): work `0x8000–0x87FF`, colour `0x8800–0x8BFF`, video/tilemap
`0x9000–0x93FF`, attribute+sprite `0x9800–0x98FF` (per-column scroll `0x9800–0x983F`, 8 sprite
records `0x9840–0x985F`). The frame is a 32×32 tile grid (`paintScreen`) with a companion
colour layer; the shared column plotter (`rowColToTileOffset` → `deriveTileWriteCursors` →
`copyTileColumn`/`copyCappedTileColumn`/`fillColourColumn*`, run length `PLOT_RUN_LENGTH`) paints
straight down map columns. HUD/furniture painters draw the edges, score HUDs, men/credits/label
panels, and GAME OVER. Each frame the NMI LDIRs the 32-byte staging buffer `SPRITE_STAGING_BASE`
(0x8220) to hardware sprite RAM 0x9840; `stageObjectSpriteRecord` / `stageActorSpriteRecords` /
`stageDigObjectSpriteRecord` fill it, `clearSpriteStagingBuffer` wipes it. The animated
background sprite (the **spider**, slots via `BG_SPRITE_*`) bounces horizontally and falls
vertically with an RNG reseed (`advanceBackgroundSprite` / `advanceBackgroundAnimation` /
`setBgSpriteFrame`); `glitterDiamonds` colour-cycles the on-screen diamond cells. `[code]`
The board (video/io/memory) layer is the one **ungated** surface — hand-transcribed from
`taito/roundup.cpp`, attract-validated — and remains a FIRST DRAFT (io.js/hardware.json say so:
watchdog timeout and some landmarks are placeholders). `[code]`

### 3.10 Sound
A sound-command ring: `enqueueSoundCommand` writes `(code|0x80)` at `SOUND_RING`+`SOUND_HEAD`
(mod 8); the NMI dequeues one per frame at `SOUND_TAIL` and writes it to the 0xB800 sound latch
(`enableSound`/`disableSound` gate the master line). Twenty thin `requestSoundN` wrappers
(commands 2–21) enqueue specific effects. **What each command *sounds* like is `[guess]`** —
there is no audio oracle; the web build plays samples/synth "above emulation," tunes BYO-recorded
by ear, and the audio Z80 + AY chips are not emulated.

### 3.11 Shooting — the missing weapon
Restated because it is the sharpest lore correction: **no routine in the 169 reads the fire
button to spawn a projectile.** BUTTON1 (IN0 bit4) exists and is read as dig/confirm only
(§2b). Enemies cannot be shot; survival is evasion. If a future observation ever surfaces a
shooting path this is where to flag it — but the current code has none. `[code]`

---

## 4. Confidence conventions

- **`[seen]`** — grounded by playing the real ROM in MAME 0.288 (the Phase-1 observation rounds
  in `docs/PIT-CLARIFY-LEARNINGS.md`).
- **`[code]`** — read directly from the current idiomatic routines / `ram.js` / board layer.
- **`[guess]`** — plausible but unproven; the honest floor.

**The honest floor (one more pass won't move these — structural, not unlooked):**
sound-command → audio mapping is `[guess]` (no oracle); `VARIANT` (0x8048) and
`DIG_OVERLAP_HOLD` (0x8080, the refuted "climb gate") are dormant in every reachable play path;
the left-vs-right sign of the movers (`CARVE_SEAM_LEFT`/`RIGHT`) is rotation-ambiguous — the axis
is confirmed screen-horizontal but which arm is "left" is not pinned; the `DIAMOND_COLLECTED`
byte-reuse coupling (§3.2) is unproven. `ram.js` name confidence is tagged `(strong/fair/weak)`
per cell; the pixel gate, not the name, is the correctness authority.

---

## 5. Routine map — all 169 (by ROM address)

| ROM | Routine | Role |
|---|---|---|
| 0x0000 | `resetVector` | Power-on entry: the first thing the CPU runs after reset. |
| 0x0066 | `serviceVblankNmi` | Per-frame vblank service: ack, watchdog/credit guard, fire a queued sound, blit sprites, tick timers, debounce inputs. |
| 0x01a4 | `coldBootInit` | Power-on cold-boot init: bring the machine up from reset and seed state. |
| 0x01f9 | `rearmMachineAndBranchOnCredits` | Boot/restart entry: re-arm the machine, fork on the credit count. |
| 0x021c | `showCreditScreen` | Warm-restart entry: arm game mode 3, reset the work stack, enable interrupts. |
| 0x022d | `startGame` | Set up a fresh game once a credit registers, then enter play. |
| 0x0278 | `dockManAndDispatchRoundBoundary` | Round boundary: dock the active player's man, persist their record, route to setup/teardown. |
| 0x02a1 | `stepRoundSubPhaseAndBranch` | Sequence the round sub-phase byte; hand off to setup or teardown. |
| 0x02ca | `setUpRoundAndHoldIntro` | One-time round-start setup: load the player's saved progress, hold the intro. |
| 0x02e1 | `holdRoundIntroLoop` | Round-start intro-hold loop: repaint the "PLAYERS" HUD label. |
| 0x02fd | `advanceToNextLevel` | Clear the current level, `LEVEL`++, rebuild the fixed board (mode 160). |
| 0x031a | `initRoundAndEnterMainLoop` | Final per-round (re)init: run the setup chain, derive `MAIN_LOOP_DELAY`, enter the loop. |
| 0x0348 | `mainLoop` | The in-game / attract-demo main loop: one frame of game work, forever. |
| 0x0371 | `submitHighScoresAndReset` | Game-over teardown: offer each finishing player's final score, then reset. |
| 0x03ac | `resetStateAndShowSetup` | Reset/round-restart epilogue: begin a fresh attract cycle. |
| 0x03be | `enterPlayMode` | Switch into active play, seed the per-round counters. |
| 0x03e8 | `steerDemoPlayer` | Generate the attract demo's per-frame one-hot steering. |
| 0x0673 | `paintScreen` | Lay down a whole screen: a selectable tile layer and its colour. |
| 0x06ac | `glitterDiamonds` | Colour-cycle the on-screen diamond cells so they glitter. |
| 0x1362 | `seedObjectStartState` | Drop the tracked-object / level state block back to its start values. |
| 0x13c9 | `dispatchObjectFrameByStateTimer` | Head of the object/state dispatcher, gated by the state-lockout timer. |
| 0x13de | `advanceTrackedObject` | Route the tracked object (digger) to its per-frame handler by its state gates. |
| 0x1420 | `stepObjectFromControl` | Advance the tracked object one frame from its control input (joystick or demo). |
| 0x1434 | `advanceObjectFrame` | Pick the object's per-frame update from its mode + move command. |
| 0x144c | `routeIdleObjectByMoveCommand` | Route an at-rest object on its move-command **direction** bits (0x01/0x02/0x0c). |
| 0x1468 | `windUpObjectMove` | Settle the object's animation phase toward a move command, then run its handler. |
| 0x1493 | `stepObjectRowFlipped` | Step the object the opposite way along its move axis; fire the dig one-shot at the boundary. |
| 0x14cd | `locateObjectCellCheckGoal` | Locate the object's tilemap cell; latch a goal crossing if the goal is just ahead. |
| 0x1515 | `collectAlignedLootElseResolveTile` | Collect a loot tile the object landed on, else resolve the tile. |
| 0x1568 | `resolveObjectTerrainStep` | Resolve a moving object's step against the terrain under it. |
| 0x1659 | `advanceObjectWalkFrame` | Step a moving object's walk animation, then build its record. |
| 0x167f | `stepObjectRowUnflipped` | Advance the object one step along the row axis; derive its tile row. |
| 0x16b9 | `locateActorCellCheckGoal` | Route a moving actor's horizontal step; detect goal reach. |
| 0x1704 | `resolveActorTerrainStep` | Resolve a moving actor's horizontal step vs terrain; collect loot (death pose `0x35` on the kill path). |
| 0x184a | `walkActor` | Advance an actor's walk: accumulate position, pick the walk frame. |
| 0x186a | `stampFixedFrameAndResolveTile` | Stamp the actor's fixed animation frame, then run the shared cell/tile tail. |
| 0x186f | `resolveObjectTile` | Locate the object's tile cell, read the tile under it, dispatch. |
| 0x18cf | `collectLootTile` | Collect the scoring loot tile the actor aligned onto; +20 gated by the feature latch. |
| 0x191f | `triggerDigReaction` | Classify the tile under a digging actor and stage its reaction. |
| 0x19d0 | `advanceActorWalk` | Carry an actor's walk one frame; fire the goal-crossing far-edge one-shot. |
| 0x19e3 | `drawActorWalkFrame` | Commit the actor's animation frame; fire the crossing's far-edge one-shot. |
| 0x1a02 | `stepObjectAndResolveTile` | **Core dig/collect/surface:** step the digger along the climb axis, resolve loot/solid/diggable, set the win flag at the top rung. |
| 0x1b5b | `stageObjectSpriteRecord` | Build the object's 4-byte deferral sprite record at 0x8220. |
| 0x23e8 | `reseedColumnAnimation` | Seed a tilemap write pointer + level-scaled countdown; cue the reveal. |
| 0x241c | `advanceColumnAnimation` | One frame-gated step of a vertical tile-column animation. |
| 0x24cf | `resetReactionState` | Reset the per-object reaction state machine to idle. |
| 0x24f3 | `advanceReactionObject` | Per-frame driver of the dig/push reaction; reads BUTTON1 as **dig-held** / starts the scroll. |
| 0x287a | `seedDigObjectBlock` | Seed the dig/target object control block at round start. |
| 0x28ab | `spawnDigEntity` | Stage a dig entity at the actor's aligned cell, commit it. |
| 0x2934 | `commitDigEntity` | Commit one dig entity into its tilemap cell, patch neighbours. |
| 0x29ad | `advanceDigCarveObject` | Per-frame driver for the dig/carve object. |
| 0x2bd3 | `stageDigObjectSpriteRecord` | Compose the dig object's sprite so it draws at its cell. |
| 0x2bf2 | `startNextDigSpawn` | Start the next queued dig-object spawn, or clear the spawn-active flag. |
| 0x2c04 | `spawnPendingDigObject` | Pop a random queued column and spawn a dig object there. |
| 0x2c91 | `flagObjectTargetOverlap` | Flag whether the placed dig-target cell coincides with the object (the "projectile-spawn" comment = this loot cell). |
| 0x2cb7 | `captureTargetOnOverlap` | Tick the dig target's countdown; on expiry snap the target. |
| 0x2d06 | `advanceDigTarget` | Advance the dig target one step, route on the tile it now covers. |
| 0x2d4e | `landDigTarget` | Land the descending dig/capture target when it reaches terrain. |
| 0x2d6b | `stampGlyphColumn` | Stamp the fixed five-tile glyph down the object's map column. |
| 0x2f2f | `seedBackgroundAnimParams` | Seed round/level param block 1; derive `REVEAL_PERIOD` = 7−min(LEVEL+1,4). |
| 0x2f71 | `advanceBackgroundSprite` | Per-frame driver for the animated background sprite (the spider). |
| 0x2f88 | `revealTerrainColumn` | Reveal the next column of the scrolling terrain backdrop. |
| 0x2fb7 | `drawTerrainColumn` | Write one vertical strip of backdrop tiles, tick the reveal. |
| 0x2fc0 | `advanceBackgroundAnimation` | Per-frame phase clock for the background flip animation. |
| 0x2fd9 | `setBgSpriteFrame` | Commit the chosen background flip tile. |
| 0x30de | `seedObjectRecords` | Seed round/level param block 2; derive `OBJ1_MOVE_PERIOD` = 7−(LEVEL&6). |
| 0x312d | `advanceObjectMovers` | Per-frame object-pair mover pass: drive OBJ1 (claw-creature). |
| 0x316f | `advanceObjectMover2` | Advance OBJ2 (claw-creature) one frame, stage its sprite. |
| 0x319d | `stepEnemyMover` | **Shared enemy step:** arrival/capture/retarget/patrol; the death-on-contact box overlap lives here. |
| 0x33bc | `tileInProbeRow` | Is the tile at a mover's probe cell listed in this phase's table? |
| 0x33da | `probeRowBackTilePair` | Probe phase-keyed ROM tables for the tile one row back. |
| 0x3410 | `nextTileInProbeRow` | Sibling table search for the object-movement dispatcher. |
| 0x3425 | `probeRowAheadTilePair` | Two-stage probe: the tile one row ahead of the mover. |
| 0x3458 | `tickObjectDwellThenTransition` | Tick a per-object state countdown; blink the sprite (death dwell). |
| 0x3476 | `stepMoverUp` | One preset move-step for the mover: step its X along a column. |
| 0x347d | `stepMoverMirrored` | Object-mover step for direction 1. |
| 0x3484 | `stepMoverDown` | Fixed-direction patrol-mover preset. |
| 0x348b | `stepMoverUnmirrored` | Object-mover step for direction 3. |
| 0x34da | `advanceDormantMover` | Mover housekeeping: advance two cadence counters. |
| 0x34f0 | `reseedMoverCadenceAndRearmState` | Periodic refresh: reseed the cadence byte, re-arm the mover state. |
| 0x36fe | `seedActorSpawnState` | Put the two-body actor (saucer + twin) into its spawn state. |
| 0x3748 | `advanceTwoSpriteActor` | Per-frame update for the two-sprite actor (saucer body + twin). |
| 0x37cf | `spawnAltPhaseActor` | Bring the alt-phase actor (primary + shadow twin) online. |
| 0x384a | `advanceAltPhaseActor` | Per-frame animate + march step for an active object. |
| 0x38c8 | `advanceOrRebuildTwinActor` | Per-frame gate for the two-body actor; keep it moving while in view. |
| 0x3945 | `paceActorCadence` | Cadence front-end for the actor phase body (period-8 timer). |
| 0x3968 | `easeActorToRest` | Coordinate stepper: ease an actor's coord toward rest; lock the twin +16. |
| 0x3984 | `spawnTwinActor` | Spawn the two-body actor once when its spawn is requested. |
| 0x3a13 | `advanceActorMovers` | Advance the two-sprite actor's record(s) through the shared mover. |
| 0x3a4c | `stageActorSpriteRecords` | Stage the actor's two hardware sprite records (slots 6/7). |
| 0x3a6f | `showSetupScreen` | Paint the round-setup screen (playfield furniture + HUD counts). |
| 0x3b81 | `showFixedScreen` | Paint a canned full-screen image from ROM, hold briefly. |
| 0x3ba8 | `holdFixedScreen` | Paint a canned full-screen image, hold it forever. |
| 0x3bec | `showBonusScreen` | Tier-selected bonus screen (5/10/15 → 5000/10000/15000), animated hold. |
| 0x3cc1 | `drawSharedPanel` | Lay out the fixed panel: left edge + both players' score HUD. |
| 0x3d49 | `drawSetupCreditsPanel` | Paint a fixed 9-cell HUD panel at column 1, row 12. |
| 0x3d7e | `cycleStagedColumnColour` | Advance the `BOARD_MODE` byte (bit3 clear), paint it as colour. |
| 0x3d8a | `drawGameOverText` | Paint a fixed 9-cell vertical strip at column 6, row 12. |
| 0x3dae | `rowColToTileOffset` | Turn a (row, column) tile-cell into a linear tilemap offset. |
| 0x3dc9 | `deriveTileWriteCursors` | Turn a tilemap offset into colour-RAM + video-RAM write cursors. |
| 0x3ddb | `copyCappedTileColumn` | Copy a tile-code run down a VRAM column, capping the top cell. |
| 0x3dea | `copyTileColumn` | Copy a stored run of tile codes straight down a VRAM column. |
| 0x3e01 | `fillColourColumn` | Paint a vertical run of colour-RAM cells with one byte. |
| 0x3e13 | `cycleColumnColour` | Advance the shared colour index; repaint one column. |
| 0x3e1d | `fillColourColumnAt` | Paint a full-height colour-RAM column with one colour. |
| 0x4632 | `saveActivePlayerRecord` | Copy the live game record into the active player's backup slot. |
| 0x4644 | `loadPlayerState` | Make the selected player's saved level/score the live state. |
| 0x4673 | `awardOnePoint` | Add one point to the running score. |
| 0x467b | `awardTenPoints` | Add 10 (with sound), repaint the digits. |
| 0x4683 | `awardTwentyPoints` | Add 20 (with sound), repaint the digits. |
| 0x4689 | `addScore` | BCD-add points to the active player's score, repaint. |
| 0x46af | `drawScoreDigits` | Repaint the active player's on-screen score digits. |
| 0x46f4 | `drawLeftEdgeColumn` | Stamp the fixed playfield left edge column. |
| 0x472c | `redrawScoreHud` | Repaint both players' score displays + status. |
| 0x4785 | `drawBestScoresTodayLabel` | Stamp a fixed edge column, tint it. |
| 0x47a1 | `drawRightEdgeColumn` | Draw the rightmost playfield column from work RAM. |
| 0x47e1 | `drawPlayerLabel` | Paint a fixed vertical panel (tile column + colour). |
| 0x4816 | `paintPlayfieldStripCol1Row11` | Paint one fixed vertical strip of the static playfield. |
| 0x483a | `drawMenLeftPanel` | Paint the men-left HUD panel at column 5 (two variants). |
| 0x4894 | `drawCreditsDisplay` | Paint the credits HUD panel at column 6, row 10. |
| 0x48c4 | `cyclePanelColumnColour` | Recolour a fixed nine-cell colour-RAM column. |
| 0x48e5 | `drawGameOverLabel` | Stamp the "GAME OVER" label down its HUD column. |
| 0x492a | `drawCopyrightLine` | Paint one 32-tile screen column, colour it. |
| 0x4b10 | `disableFrameInterrupt` | Switch the per-frame (vblank) interrupt off. |
| 0x4b14 | `enableNmi` | Switch on the per-frame vblank interrupt. |
| 0x4b1a | `advanceRandom` | Step the 16-bit LFSR PRNG, return a fresh byte. |
| 0x4b3c | `setupBoardModeC0` | Stow the 0xC0 board-mode byte, run the shared display setup. |
| 0x4b40 | `setupBoardMode90` | Stow the 0x90 board-mode byte, rebuild the screen. |
| 0x4b44 | `blankScreen` | The mode-0 door into the shared display-setup body. |
| 0x4b46 | `setupBoardDisplay` | Record the board-mode byte, rebuild the whole screen (mode 160 at level up). |
| 0x4b55 | `applyDipSwitches` | Read the cabinet DIP switches, commit difficulty/lives/coinage. |
| 0x4bc7 | `initScoreDisplay` | Blank the readout strip, seed three zeroed readout records. |
| 0x4bea | `resetScoreAndSoundQueue` | Blank the score bytes + sound queue. |
| 0x4bff | `waitFrames` | Pause a fixed number of video frames, then return. |
| 0x4c11 | `clearSpriteAndAttributeRam` | Wipe sprites + per-column scroll for a clean frame. |
| 0x4c1c | `clearSpriteStagingBuffer` | Zero the 64-byte staging block during setup. |
| 0x4c27 | `fillVideoRam` | Paint every tilemap cell with one tile code. |
| 0x4c37 | `fillColorRam` | Repaint every colour-RAM cell with one board-mode byte. |
| 0x4c47 | `disableSound` | Pull the sound-enable line low (silence). |
| 0x4c4d | `enableSound` | Switch the master sound-enable line on. |
| 0x4c57 | `requestSound2` | Enqueue sound-command 2. |
| 0x4c5b | `requestSound3` | Enqueue sound-command 3. |
| 0x4c5f | `requestSound4` | Enqueue sound-command 4 (game-start). |
| 0x4c63 | `requestSound5` | Enqueue sound-command 5. |
| 0x4c67 | `requestSound6` | Enqueue sound-command 6. |
| 0x4c6b | `requestSound7` | Enqueue sound-command 7. |
| 0x4c6f | `requestSound8` | Enqueue sound-command 8. |
| 0x4c73 | `requestSound9` | Enqueue sound-command 9. |
| 0x4c77 | `requestSound10` | Enqueue sound-command 10. |
| 0x4c7b | `requestSound11` | Enqueue sound-command 11. |
| 0x4c7f | `requestSound12` | Enqueue sound-command 12. |
| 0x4c83 | `requestSound13` | Enqueue sound-command 13. |
| 0x4c8b | `requestSound15` | Enqueue sound-command 15. |
| 0x4c8f | `requestSound16` | Enqueue sound-command 16. |
| 0x4c93 | `requestSound17` | Enqueue sound-command 17. |
| 0x4c97 | `requestSound18` | Enqueue sound-command 18. |
| 0x4c9b | `requestSound19` | Enqueue sound-command 19. |
| 0x4c9f | `requestSound20` | Enqueue sound-command 20 (enemy capture). |
| 0x4ca3 | `requestSound21` | Enqueue sound-command 21. |
| 0x4ca5 | `enqueueSoundCommand` | Append one sound request to the ring buffer. |
| 0x4cbf | `submitPlayerHighScore` | Offer the finishing player's score to the "BEST SCORES" table. |
| 0x4cca | `renderScoreReadouts` | Lay the three score-readout numbers into their display cells. |
| 0x4d0c | `unpackScoreDigits` | Expand the staged packed score into display digit cells. |
| 0x4d3a | `insertHighScore` | Ranked-insert a candidate into the descending three-entry table. |
| 0x4df8 | `runHighScoreInitialsEntry` | The initials-entry screen: build display, run the dial loop, commit. |
| 0x4eea | `stepHighScoreInitialsEntry` | Per-frame initials-entry action dispatch; reads BUTTON1 to confirm. |
| 0x4f26 | `stepInitialDown` | Step a bounded cyclic index down one notch, request sound 8. |
| 0x4f38 | `advanceInitialUp` | Step a cyclic index up one notch, request sound 8. |
| 0x4f47 | `showColourTestScreen` | The DIP-selected colour/tile test pattern (UP+BUTTON1 advances). |

## 6. RAM map — all 141 named cells (by address)

Confidence tags in parentheses are the `ram.js` provenance grade (`strong`/`fair`/`weak`).

| Addr | Name | Role |
|---|---|---|
| 0x8000 | `CREDIT_COUNT` | Credit counter (clamp 9); watchdog anchor (strong). |
| 0x8001 | `GAME_MODE` | Player count / mode: 1/2 = 1P/2P, ≥3 = attract demo (fair). |
| 0x8002 | `GAME_STATE2` | Active-player index (fair). |
| 0x8003 | `COIN_SW_ACCUM` | Coin-switch edge accumulator (strong). |
| 0x8004 | `START1_SW_ACCUM` | 1P-start switch accumulator (strong). |
| 0x8005 | `START2_SW_ACCUM` | 2P-start switch accumulator (strong). |
| 0x8007 | `FRAME_COUNTER_PRESCALER` | /60 down-divider feeding `FRAME_COUNTER` (strong). |
| 0x8009 | `FRAME_WAIT_COUNTDOWN` | Per-frame countdown the NMI decrements; `waitFrames` arms it (fair). |
| 0x800a | `LOOP_COUNTER` | Memory-resident loop down-counter (fair). |
| 0x800d | `PRNG_LOW` | LFSR low byte + the returned random draw (strong). |
| 0x800e | `PRNG_HIGH` | LFSR high byte (strong). |
| 0x8010 | `FRAME_COUNTER` | Frame counter cleared at reset/round init (fair). |
| 0x8011 | `MAIN_LOOP_DELAY` | Per-frame busy-wait = `LOOP_DELAY_BASE − LEVEL` (strong). |
| 0x8015 | `IN1_DEBOUNCED` | Debounced IN1 (coin/start) (strong). |
| 0x8016 | `IN1_PREV` | Previous IN1 sample (strong). |
| 0x8018 | `IN0_DEBOUNCED` | Debounced IN0 (joystick + dig button) (strong). |
| 0x8019 | `IN0_PREV` | Previous IN0 sample (strong). |
| 0x801a | `OBJECT_PHASE` | Object packed anim/command phase (fair). |
| 0x801b | `DEMO_STEER_DIR` | Attract-demo one-hot steering command (strong). |
| 0x801c | `CREDIT_MIRROR_A` | Redundant credit copy (watchdog) (strong). |
| 0x801e | `SOUND_HEAD` | Sound-ring head index mod 8 (strong). |
| 0x801f | `SOUND_TAIL` | Sound-ring read/dequeue index mod 8 (strong). |
| 0x8020 | `SOUND_RING` | Sound-ring buffer base (8 slots) (strong). |
| 0x8028 | `LEVEL` | Current player's level/round; every difficulty knob scales off it (strong). |
| 0x802b | `MEN_LEFT` | Active player's working lives count (strong). |
| 0x8031 | `SCORE_LO` | Low packed-BCD score byte (fair). |
| 0x8034 | `SCORE_HI` | High packed-BCD score byte (fair). |
| 0x8037 | `SCORE_DISPLAY_LOW` | Low byte of the 16-bit score staged for display (fair). |
| 0x8038 | `SCORE_DISPLAY_HIGH` | High byte of the staged display score (fair). |
| 0x8039 | `HIGH_SCORE_TABLE` | Base of the descending 3-entry table (5-byte records) (fair). |
| 0x8048 | `VARIANT` | Round-variant selector; dormant in reachable paths (weak). |
| 0x804b | `INITIALS_REMAINING` | Initials-entry down-counter (3→0) (strong). |
| 0x804c | `COINS_PER_CREDIT_A` | DSW coin cost, line 2 (strong). |
| 0x804d | `COINS_PER_CREDIT_B` | DSW coin cost, line 3 (strong). |
| 0x804e | `LOOP_DELAY_BASE` | DSW main-loop pacing base (strong). |
| 0x804f | `STEP_TIMER_BASE` | DSW step-timer base; seeds 0x8067 = base − 4·LEVEL (fair). |
| 0x8051 | `SPRITE_COORD_BIAS` | Cabinet-derived pixel offset (0 in normal play) (strong). |
| 0x8053 | `STARTING_MEN` | DSW starting lives (3 or 4) (strong). |
| 0x8055 | `PLOT_RUN_LENGTH` | Run length for the shared column plotter (strong). |
| 0x8057 | `BOARD_MODE` | Board/entry-select mode byte (fair). |
| 0x8058 | `TILE_COL` | Tile-cell column byte for (row,col)→offset (fair). |
| 0x8059 | `TILE_ROW` | Tile-cell row byte (fair). |
| 0x805a | `TILEMAP_OFFSET` | 16-bit tilemap offset 32·row+col (fair). |
| 0x805c | `GLITTER_COUNTDOWN` | Diamond-glitter recolour countdown (fair). |
| 0x805e | `COLOUR_RAM_CURSOR` | 16-bit colour-RAM write cursor (fair). |
| 0x8065 | `COLUMN_ANIM_WRITE_PTR` | VRAM write cursor for the column-reveal animation (fair). |
| 0x8067 | `COLUMN_ANIM_TIMER` | Per-step frame countdown for the column animation (fair). |
| 0x8068 | `OBJ_X` | Tracked-object screen-horizontal probe; drives the tilemap **row** (strong). |
| 0x8069 | `SPRITE_CODE` | Current sprite/anim frame code for the actor being drawn (strong). |
| 0x806a | `OBJ_SPRITE_ATTR` | Object sprite attribute (palette + priority) (fair). |
| 0x806b | `OBJ_Y` | Tracked-object screen-vertical probe; drives the tilemap **column** (strong). |
| 0x806c | `OBJ_STEP_X` | Tracked-object per-frame X step (fair). |
| 0x806d | `OBJ_STEP_Y` | Tracked-object per-frame Y step (fair). |
| 0x806e | `ACTOR_CELL_PTR` | 16-bit ptr to the actor's current VRAM display cell (strong). |
| 0x8071 | `OBJ_TILE_COL` | Tilemap column cell under the tracked object (fair). |
| 0x8073 | `OBJ_TILE_ROW` | Tilemap row cell under the tracked object (fair). |
| 0x8076 | `FEATURE_TILE_LATCH` | Under-tile `0x26` latch; **prerequisite that unlocks the +20 diamond pickup** (fair). |
| 0x8077 | `GOAL_CROSSING_LATCH` | Second-stage goal-crossing latch (drives the post-goal walk) (fair). |
| 0x8078 | `DIAMOND_COLLECTED` | Set on a +20 diamond pickup; at the top rung → `SPAWN_PHASE`=1 = **win** (fair). |
| 0x8079 | `OBJECT_ACTIVE` | Tracked-object presence flag (0 / 0xff) (strong). |
| 0x807b | `SPAWN_PHASE` | Spawn/alt-phase flag; **level-complete trigger** the completion actor fires on (fair). |
| 0x807c | `STATE_TIMER` | State-lockout countdown for the tracked object (fair). |
| 0x807e | `CARVE_SEAM_LEFT` | Dug-channel seam flag, one move arm (axis horizontal; L/R side unpinned) (fair). |
| 0x807f | `CARVE_SEAM_RIGHT` | Mirror seam flag, opposite move arm (fair). |
| 0x8080 | `DIG_OVERLAP_HOLD` | Dig-target box-overlap hold flag (the refuted "climb gate") (weak). |
| 0x8081 | `LOOT_10PT_COUNT` | Count of +10 dirt-gem pickups; ==4 adds a bonus tier (fair). |
| 0x8082 | `LOOT_20PT_COUNT` | Count of +20 diamond pickups; ==3 adds a bonus tier (fair). |
| 0x8084 | `ACTOR_STATE` | Actor state/timer + sprite-code byte (weak). |
| 0x8089 | `PROBE_CELL_PTR` | 16-bit VRAM/tilemap cell ptr for the mover tile probes (fair). |
| 0x808b | `MOVER_CADENCE` | Mover cadence/dwell timer (weak). |
| 0x808d | `SUBTILE_PHASE` | Sub-tile phase / probe-table row index (fair). |
| 0x8090 | `MOVER_STATE` | Signed mover state byte `stepEnemyMover` sign-dispatches on (fair). |
| 0x8091 | `MOVER_MOVE_PERIOD` | Working-block mover cadence reload period (fair). |
| 0x8092 | `MOVER_DIRECTION` | Published travel-direction index 0/1/2/3 (fair). |
| 0x8093 | `MOVER_TARGET_COL` | Working-block mover target column (fair). |
| 0x8094 | `REACTION_OBJ_X` | X of the reaction-state entity (OBJ_X-paired) (fair). |
| 0x8095 | `REACTION_OBJ_CODE` | Sprite/frame-code byte of the reaction object record (strong). |
| 0x8096 | `REACTION_OBJ_ATTR` | Attribute/anim byte of the reaction object record (strong). |
| 0x8097 | `REACTION_OBJ_Y` | Y of the reaction-state entity (OBJ_Y-paired) (fair). |
| 0x809a | `SCROLL_WINDOW_PTR` | Tilemap cell the horizontal terrain-scroll walker samples (fair). |
| 0x809e | `SCROLL_SUBPHASE` | Sub-tile column phase selecting the ROM stop-tile slice (fair). |
| 0x80a2 | `REACTION_STATE` | Per-object reaction/animation state (0 idle, 1–4 armed) (strong). |
| 0x80a4 | `REACTION_TIMER` | Reaction step/animation countdown (strong). |
| 0x80a5 | `CUR_TILE` | Saved current tile under the object (fair). |
| 0x80a7 | `EXPECTED_TILE` | The cell's table-resolved expected tile (fair). |
| 0x80a8 | `NEXT_TILE` | Next-tile slot, pre-cleared before classify (fair). |
| 0x80a9 | `TARGET_X` | X of the dig-spawned target/loot cell (strong). |
| 0x80aa | `DIG_OBJ_STATE` | Dig/carve object phase byte (0x30 carving / 0x09 done / 0x10 spawn) (fair). |
| 0x80ab | `DIG_OBJ_ATTR` | Colour+priority attribute of the dig-object sprite record (fair). |
| 0x80ac | `TARGET_Y` | Y of the dig-spawned target/loot cell (fair). |
| 0x80b1 | `DIG_OBJ_TIMER` | Countdown/animation timer for the dig object (fair). |
| 0x80b6 | `STAGED_TARGET_X` | Staged X handed into `TARGET_X` (fair). |
| 0x80b9 | `STAGED_TARGET_Y` | Staged Y handed into `TARGET_Y` (fair). |
| 0x80ba | `STAGED_CELL_PTR` | Staged copy of `ACTOR_CELL_PTR` for the carve cursor (fair). |
| 0x80bc | `STAGED_DIG_TIMER` | Staged dig timer handed into `DIG_OBJ_TIMER` (fair). |
| 0x80bd | `SPAWN_STATE` | Dig-object active-spawn state (0 idle) (fair). |
| 0x80bf | `STAGED_DIG_SPRITE_ID` | Staged dig-entity id stamped into the tilemap cell (fair). |
| 0x80c0 | `DIG_OBJ_SUBTYPE` | Sub-type of the committed dig entity (0 plain / 2 special) (fair). |
| 0x80c1 | `DIG_OBJ_ARM_STATE` | Arm/capture state of the carve object (0/1/2) (fair). |
| 0x80c3 | `DIG_SPAWN_QUEUE` | Base of the 24-slot pending-spawn column queue (fair). |
| 0x80db | `BG_SPRITE_X` | Background spider X (horizontal bounce oscillator) (fair). |
| 0x80dc | `BG_SPRITE_FRAME` | Background spider tile/frame code (toggles 0x38↔0x39) (fair). |
| 0x80dd | `BG_SPRITE_ATTR` | Background spider attribute byte (fair). |
| 0x80de | `BG_SPRITE_Y` | Background spider Y (accelerating fall, RNG reseed) (fair). |
| 0x80e3 | `ANIM_PHASE_COUNTER` | Down-counter mod 8 gating the background flip + oscillator (fair). |
| 0x80e4 | `REVEAL_PERIOD` | Level-scaled reveal reload = **`7 − min(LEVEL+1, 4)`** (6→3) (fair). |
| 0x80e5 | `REVEAL_GATE` | Per-column reveal frame-gate down-counter (fair). |
| 0x80e6 | `REVEAL_CURSOR` | Offset into the reveal tile-pattern table; ==0 = reveal finished (fair). |
| 0x80e7 | `GOAL_TILE_LATCH` | Set when the object reaches goal tile `0x27`; enables the scroll-reveal (fair). |
| 0x80e8 | `OBJ1_X` | OBJ1 (claw-creature) record base / X (fair). |
| 0x80e9 | `OBJ1_SPRITE_CODE` | OBJ1 sprite code + orientation (fair). |
| 0x80ea | `OBJ1_ATTR` | OBJ1 colour+priority attribute (fair). |
| 0x80f0 | `OBJ1_TIMER` | OBJ1 cadence/dwell countdown (record offset 8) (fair). |
| 0x80f5 | `OBJ1_STATE` | OBJ1 signed state byte (sign-dispatched) (fair). |
| 0x80f6 | `OBJ1_MOVE_PERIOD` | OBJ1 cadence reload = **`7 − (LEVEL & 6)`** (fair). |
| 0x80f8 | `OBJ1_TARGET_COL` | OBJ1 target column (fair). |
| 0x80f9 | `OBJ2_X` | OBJ2 (claw-creature) record base / X (fair). |
| 0x80fa | `OBJ2_TILE` | OBJ2 sprite tile/code (fair). |
| 0x80fb | `OBJ2_ATTR` | OBJ2 colour attribute (fair). |
| 0x8101 | `OBJ2_TIMER` | OBJ2 cadence/dwell countdown (fair). |
| 0x8106 | `OBJ2_STATE` | OBJ2 signed state byte (fair). |
| 0x8107 | `OBJ2_MOVE_PERIOD` | OBJ2 cadence reload period (strong). |
| 0x8109 | `OBJ2_TARGET_COL` | OBJ2 target column (strong). |
| 0x810a | `ACTOR_X` | Saucer primary half X (fair). |
| 0x810b | `ACTOR_TILE` | Saucer primary half tile field (fair). |
| 0x810c | `ACTOR_ATTR` | Saucer primary half colour+priority attribute (fair). |
| 0x810d | `ACTOR_Y` | Saucer primary half Y (fair). |
| 0x810e | `ACTOR_STEP_X` | Low byte of the saucer's step vector (fair). |
| 0x810f | `ACTOR_STEP_Y` | High byte of the saucer's step vector (fair). |
| 0x8112 | `ACTOR_TIMER` | Saucer cadence timer (fair). |
| 0x811b | `TWIN_X` | Saucer twin half X, locked +16 to `ACTOR_X` (fair). |
| 0x811c | `TWIN_TILE` | Saucer twin half tile field (fair). |
| 0x811d | `TWIN_ATTR` | Saucer twin half attribute (fair). |
| 0x811e | `TWIN_CLEAR` | Saucer twin mirror clear byte (weak). |
| 0x8123 | `TWIN_TIMER` | Twin cadence countdown (twin of `ACTOR_TIMER`) (fair). |
| 0x812c | `CREDIT_MIRROR_B` | Third redundant credit copy (watchdog) (strong). |
| 0x8134 | `SAVED_CELL_PTR` | 16-bit scratch holding a tilemap cell ptr during a probe search (fair). |
| 0x8220 | `SPRITE_STAGING_BASE` | Base of the 32-byte sprite-record staging buffer (NMI LDIRs to 0x9840) (fair). |
| 0x8238 | `ACTOR_SPRITE_SLOT` | Sprite-staging slot 6 (the saucer body's record) (fair). |
| 0x823c | `TWIN_SPRITE_SLOT` | Sprite-staging slot 7 (the twin's record) (fair). |
| 0x8280 | `SCORE_READOUT_STRIP` | Base of a 32-cell work-RAM strip staging the score-readout column (fair). |

---
*Blind clarify-pass rewrite: written from `gameplay.md` + the current code + the MAME grounding,
with no reference to any prior `mechanisms.md`. Counts measured from the current tree
(169 routines / 169 English-named / 0 `loc_` / 141 RAM cells).*
