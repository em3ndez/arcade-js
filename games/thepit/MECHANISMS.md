# The Pit — code-grounded mechanism map

A working model of how The Pit plays, reconstructed **from the decompiled code only**
(`games/thepit/idiomatic/*.js`, `games/thepit/idiomatic/ram.js`, `boards/thepit/video.js`).
Romset `thepitu1` (1982, Zilec/Centuri); MAME driver `taito/roundup.cpp`; Z80 CPU,
256×224 raster, ROT90.

Every ROM routine now has an idiomatic JS twin. Measured counts (grepped, not estimated):

| count | what |
|------:|------|
| **169** | routines in `idiomatic/` (excl. `ram.js`) — `ls idiomatic/*.js \| grep -v ram.js \| wc -l` |
| **134** | with an **earned English name** |
| **35**  | still `loc_<addr>` (neutral — role clear, game-meaning not pinned to the naming bar) |
| **140** | named work-RAM cells exported from `ram.js` (`grep -c '^export const'`) |
| **19**  | sound-trigger stubs (`requestSound2..21`, minus 1 & 14) sharing one enqueue tail |

Each idiomatic file is memory-equivalent to a frozen `translated/` oracle, gated by a
per-routine `equivalence-<addr>.test.js`. The names in `ram.js` are cross-routine
proposals tagged `(strong)/(fair)/(weak)`; the **pixel gate, not the name, is the
correctness authority** (a wrong name is worse than a hex address).

---

## Tag convention

- **[seen]** — observed in a captured MAME frame (the pixel harness confirms it).
- **[code]** — derived from a routine's behaviour (memory-equivalent to the oracle, but
  the on-screen meaning is inferred from the code, not from a frame).
- **[guess]** — plausible reading, not yet verified. Treat as a hint.

Rotation caveat that recurs below: the display is **ROT90**, and the code's "X"/"Y" and
"row"/"column" labels are the *record-byte* conventions (offset 0 = X), **not** confirmed
screen axes. Which mover coordinate is on-screen horizontal vs vertical is an open
question — flagged **[guess]** wherever it matters.

---

## What the game is

**The play** [code]/[seen]: you drive a two-frame animated **digger/actor** over a tiled
playfield and tunnel into terrain to collect scoring **loot tiles**, while enemy movers
and a bottom band of creatures threaten you. The attract demo auto-plays a digger walking
the maze walls, and that path renders **pixel-exact vs MAME** — so the playfield, the
digger, the dirt/shaft backdrop, the HUD, and enemy/creature sprites in the bottom band
are all **[seen]**. Deep digging, scoring, winning and losing never occur in attract, so
those are **[code]** only.

**The playfield** [code]: a 32×32 tile map (`0x9000`) with a parallel colour map
(`0x8800`) and per-column vertical scroll (`0x9800`). Fixed furniture: a left edge column,
a right edge column (built dynamically in work RAM), and a two-player score HUD. The
middle is diggable terrain: routines carve channels tile-by-tile, remapping tile codes
through ROM translation tables.

**Loot & scoring** [code]: two loot kinds are recognised by the tile-under-object
classifiers — **tile 58 → +10 pts**, **tiles 59..61 → +20 pts** (the +20 kind is gated by
a one-shot latch). Each kind has a running pickup counter (`LOOT_10PT_COUNT`,
`LOOT_20PT_COUNT`); `showBonusScreen` reads them against thresholds (**==4** and **==3**)
as a between-level tally — i.e. collecting the full set completes something. A collected
tile is blanked out of the map.

**Special tiles** [code]: a **goal tile (0x27)** latches "goal reached" once the object is
past crossing-column 0x53, which reroutes the state dispatcher and enables the terrain
scroll-reveal; a **feature tile (0x26)** gates the +20 loot path. What the goal represents
in the real game (surfacing with loot? reaching the wall?) is **[guess]**.

**The actors on screen** [code], with tags on identity:
- a **two-sprite ~32px-tall actor** (primary body at `0x810a` + a rigid twin locked +16px
  at `0x811b`) — the classic tall-character-from-two-16px-sprites trick, **[seen]** as one
  figure, its game identity **[guess]**;
- **two enemy/object movers** OBJ1 (`0x80e8`) / OBJ2 (`0x80f9`) that patrol the maze,
  probe tiles, capture the player, and award a point when caught in a "player box" — the
  bottom-band creatures **[seen]**, their exact role **[guess]**;
- a **dig/carve object** that tunnels the maze and spawns loot targets **[code]**;
- an **animated background sprite** that bounces sideways and falls (a decorative backdrop
  element) **[code]**.

The **"ZUN…" label** and the exact nature of the bottom **"creatures"** remain **[guess]**
(raw ROM tile strips, never decoded).

---

## Boot & the frame loop  [code]

```
reset (0x0000)  resetVector
   └─▶ coldBootInit (0x01a4)      IRQ off · reseat stack · clear 3× credit counter +
        │                         game-mode · seed coin/start debounce · ready score /
        │                         sound / hi-score tables + blank board · power-on sound ·
        │                         arm GAME_STATE2 · applyDipSwitches · hold · tail →
        └─▶ loc_03ac              reset/round-restart epilogue: clear active player ·
             │                    applyDipSwitches · showSetupScreen · tail →
             └─▶ loc_01f9         boot/restart state entry: reseat stack · enableNmi ·
                                  arm GAME_STATE2 · applyDipSwitches · FORK on restart flag:
                                    set  → showCreditScreen → holdFixedScreen (spins forever)
                                    clear→ disableSound · clear mode · showFixedScreen ·
                                           enterPlayMode → loc_031a → mainLoop
```

- **`serviceVblankNmi` (0x0066)** — the once-per-frame vblank NMI service. Order:
  ack the interrupt (drop the enable line); **credit-count watchdog** (3 redundant copies
  `0x8000`/`0x801c`/`0x812c` must agree and stay under cap, else cold-reset); dequeue ≤1
  sound command to the audio latch; **blit the 32-byte sprite staging buffer (`0x8220`) →
  hardware sprite RAM (`0x9840`)**; tick frame timers (`FRAME_WAIT_COUNTDOWN`, two ~1s
  dividers, `FRAME_COUNTER`); **debounce IN0/IN1** into `IN0_DEBOUNCED`/`IN1_DEBOUNCED`;
  **bank coins** (edge-detect each switch accumulator; a completed pulse banks a credit and
  either shows the credit screen or starts a game). Swaps to the Z80 shadow register set,
  so it clobbers nothing in the interrupted code.

- **`mainLoop` (0x0348)** — enters once a round begins and **never returns**. Each pass:
  pet the watchdog (`0xb800`), `enableNmi`, and — during the attract demo (game mode 4) —
  run `steerDemoPlayer`; then the per-frame services: `advanceTrackedObject`-family
  (via `loc_13c9`), `advanceColumnAnimation`, `glitterDiamonds`, `advanceReactionObject`.
  A pacing busy-delay (`MAIN_LOOP_DELAY = LOOP_DELAY_BASE − LEVEL`, faster at higher level)
  is dropped with the cycle model — pure timing, no memory effect.

- **`waitFrames` (0x4bff)** — arms `FRAME_WAIT_COUNTDOWN`, enables the NMI, busy-waits for
  the NMI to tick it to 0 (kicking the watchdog each pass). The boot/round-setup holds all
  route through here.

---

## Mechanisms → routines

Bold = earned English name; `loc_xxxx` = neutral. Grouped by subsystem.

### Input & attract-demo AI
| mechanism | routine(s) |
|---|---|
| Debounce the two input ports each frame | **serviceVblankNmi** (0x0066) → `IN0_DEBOUNCED`/`IN1_DEBOUNCED` |
| Attract auto-player: classify which maze wall the demo digger is against, emit a one-hot direction where the joystick would go | **steerDemoPlayer** (0x03e8) → `DEMO_STEER_DIR`; 6-band wall-line scan with a cached band hint; also does the 30-frame service tick + panel redraw |
| Choose demo-steer vs joystick as the object's move command | **stepObjectFromControl** (0x1420) (demo when mode≥3), consumed identically by `loc_144c`/`advanceObjectFrame` |

### Round / game lifecycle
| mechanism | routine(s) |
|---|---|
| Fresh game on a banked credit → seed level 1, men, score; fall into round loop | **startGame** (0x022d) |
| Switch into active play, seed per-round counters | **enterPlayMode** (0x03be) |
| Final per-round (re)init → paint board, seed object/reveal/reaction, derive loop delay, fall into `mainLoop` | `loc_031a` |
| Per-frame round-boundary head (state-lockout timer gate); on expiry route to boundary dispatcher or level advance | `loc_13c9` |
| Round/state boundary: dock the active player's man, persist their record, route to next-round setup or teardown | `loc_0278`; sub-phase sequencer `loc_02a1` |
| One-time round-start setup + intro-hold (HUD panels + playfield strip over frame-waits) | `loc_02ca`, `loc_02e1` |
| Level cleared → bump `LEVEL`, persist, rebuild screen, show bonus tally, re-enter round | **advanceToNextLevel** (0x02fd) |
| Game-over teardown: offer each player's score to the table, run initials entry, reset → attract | **submitHighScoresAndReset** (0x0371) |
| Player-record swap across the two-player turn | **loadPlayerState** (0x4644) / **saveActivePlayerRecord** (0x4632) |

### Tracked-object step & dispatch (the player-digger)
| mechanism | routine(s) |
|---|---|
| Route the tracked object to its per-frame handler by a chain of state gates | **advanceTrackedObject** (0x13de) |
| Pick the update from mode byte + move command (at-rest router vs walk steppers) | **advanceObjectFrame** (0x1434); at-rest router `loc_144c` |
| Wind-up: settle the object's animation-phase toward the move command, then dispatch | **windUpObjectMove** (0x1468) |
| Step along the move axis, derive tile row, fire the dig one-shot at the boundary row | `loc_167f` (+X arm), `loc_1493` (−X arm) |
| Locate the object's tilemap cell; latch a goal crossing if the goal is just ahead | `loc_14cd`; horizontal crossing router `loc_16b9` |

### Tile collision / classify (tile-under-object)
| mechanism | routine(s) |
|---|---|
| Locate cell, read the tile under the object, route to the matching handler | **resolveObjectTile** (0x186f) |
| Resolve the tile the object sits on: collect grid-aligned loot, else terrain step | `loc_1515` → terrain resolver `loc_1568` |
| Horizontal terrain step: collect loot / hold vs wall / bump-react / walk on | `loc_1704` |
| Vertical (climb) step-and-resolve: loot / carve into terrain / block / keep moving | **stepObjectAndResolveTile** (0x1a02) |
| Fixed-frame prologue (stamp frame code 52) then the shared cell/tile tail | `loc_186a` |
| Collect a scoring loot tile on the horizontal walk (award, count, blank cell) | **collectLootTile** (0x18cf) |
| Dig-arm: classify the tile under a digging actor, stage the reaction | **triggerDigReaction** (0x191f) |

### Loot & score
| mechanism | routine(s) |
|---|---|
| Shared BCD scorer (only while a player is active) + repaint digits | **addScore** (0x4689) → **drawScoreDigits** (0x46af) |
| Thin award entries (+1 / +10 / +20, each its own sound) | **awardOnePoint** (0x4673) / **awardTenPoints** (0x467b) / **awardTwentyPoints** (0x4683) |
| Per-kind pickup counters + completion thresholds | `LOOT_10PT_COUNT`/`LOOT_20PT_COUNT`, read by **showBonusScreen** |

### Reaction (dig/push) driver
| mechanism | routine(s) |
|---|---|
| Per-frame dig/push reaction of the tracked object (4 phases, edge-scroll, dug-entity spawn) | **advanceReactionObject** (0x24f3) |
| Reset the reaction state machine to idle at round start | **resetReactionState** (0x24cf) |

### Dig-object spawn / carve / capture
| mechanism | routine(s) |
|---|---|
| Per-frame dig/carve object driver (spawn gate, capture, carve timer, tile carving) | `loc_29ad` |
| Classify + stage a dig entity at the actor's aligned cell; commit when the slot is free | **spawnDigEntity** (0x28ab) → **commitDigEntity** (0x2934) |
| Pop a random queued column and spawn a dig object there | **spawnPendingDigObject** (0x2c04); driver **startNextDigSpawn** (0x2bf2) |
| Timed dig-target capture-box test + snap-on-overlap | **captureTargetOnOverlap** (0x2cb7); overlap flag tail `loc_2c91` |
| Advance the dig target; embed it into terrain when it lands | **advanceDigTarget** (0x2d06) → **landDigTarget** (0x2d4e) |
| Stamp a fixed glyph column at the target on the countdown sentinel | **stampGlyphColumn** (0x2d6b) |
| Build the dig object's sprite record | **stageDigObjectSpriteRecord** (0x2bd3) |
| Seed the dig-object control block + 24-slot column queue at round start | **seedDigObjectBlock** (0x287a) |

### Object/enemy movers (OBJ1 / OBJ2)
| mechanism | routine(s) |
|---|---|
| Per-frame two-object mover pass (marshal record through mover, stage sprite) | **advanceObjectMovers** (0x312d), object-2 half `loc_316f` |
| Per-frame mover step: arrival, player-box capture (+1 pt), object-box retarget, steer | `loc_319d` |
| Four fixed-direction velocity presets (step + republish facing/walk-frame) | `loc_3476` / `loc_347d` / `loc_3484` / `loc_348b` |
| Four per-direction tile probes (is the neighbour tile in this phase's ROM row?) | **tileInProbeRow** (0x33bc), `loc_33da`, `loc_3410`, `loc_3425` |
| Dwell/blink timer on arrival/capture, hand off to round transition on expiry | `loc_3458` |
| Mover housekeeping (two cadence counters) + periodic reseed | **advanceDormantMover** (0x34da), `loc_34f0` |
| Seed the object-mover records + difficulty-scaled cadence at round start | **seedObjectRecords** (0x30de) |

### Two-sprite actor (primary body + twin)
| mechanism | routine(s) |
|---|---|
| Per-frame update: dispatch by spawn state + animation phase, march + walk inline | `loc_3748` |
| Conditional one-shot spawns of the two-body actor | **spawnAltPhaseActor** (0x37cf), **spawnTwinActor** (0x3984), gate `loc_38c8` |
| Per-frame animate + march for an active alt-phase object | **advanceAltPhaseActor** (0x384a) |
| Cadence front-end + ease the actor down to a resting floor (twin +16) | **paceActorDescent** (0x3945) → **descendActorToRest** (0x3968) |
| Late/travel-phase mover: run both records through the driver, stage sprites | **advanceActorMovers** (0x3a13) |
| Walk steppers (carry position, pick 2-frame walk, build record) | **advanceActorWalk** (0x19d0) → **drawActorWalkFrame** (0x19e3); **walkActor** (0x184a); **advanceObjectWalkFrame** (0x1659) |
| Stage the actor's / object's sprite records into the buffer | **stageActorSpriteRecords** (0x3a4c); **stageObjectSpriteRecord** (0x1b5b) |
| Seed the actor pair to its fixed start pose | **seedActorSpawnState** (0x36fe); tracked-object block **seedObjectStartState** (0x1362) |

### Background sprite / terrain reveal / backdrop animation
| mechanism | routine(s) |
|---|---|
| Per-frame backdrop monolith: reveal terrain, shimmer clock, bounce/fall, publish, hand off to object movers | **advanceBackgroundSprite** (0x2f71) |
| Backdrop shimmer phase-clock + tile flip + commit tail | **advanceBackgroundAnimation** (0x2fc0), **setBgSpriteFrame** (0x2fd9), **drawTerrainColumn** (0x2fb7) |
| Reveal the next terrain column on its frame gate (standalone form) | **revealTerrainColumn** (0x2f88) |
| Seed the background-animation / reveal parameter block at round start | **seedBackgroundAnimParams** (0x2f2f) |

### Column-reveal animation
| mechanism | routine(s) |
|---|---|
| Frame-gated vertical column-carve step (fills, wall/cap logic, spawn finalise) | `loc_241c` **advanceColumnAnimation** |
| Seed the column-animation write pointer + level-scaled timer, conditional cap+sound | **reseedColumnAnimation** (0x23e8) |

### Board-display setup
| mechanism | routine(s) |
|---|---|
| Shared body: stow the board-mode byte, clear sprites, wipe tilemap, flood colour, wipe staging | **setupBoardDisplay** (0x4b46) |
| Three fan-in doors picking board-mode 0x00 / 0x90 / 0xC0 | **blankScreen** (0x4b44), `loc_4b40`, `loc_4b3c` |
| The four clear/fill primitives | **clearSpriteAndAttributeRam** (0x4c11), **fillVideoRam** (0x4c27), **fillColorRam** (0x4c37), **clearSpriteStagingBuffer** (0x4c1c) |

### Static screens
| mechanism | routine(s) |
|---|---|
| Paint a canned ROM full-screen image, hold a fixed spell / hold forever | **showFixedScreen** (0x3b81) / **holdFixedScreen** (0x3ba8) |
| Warm-restart credit screen (mode 3, held) | **showCreditScreen** (0x021c) |
| Round-setup screen (furniture + two DSW count records) + colour-cycle hold | **showSetupScreen** (0x3a6f) |
| Between-level bonus/status screen, tier-selected, count-length animated hold | **showBonusScreen** (0x3bec) |
| DSW-selected colour/tile test pattern (top DIP set) | **showColourTestScreen** (0x4f47) |
| Compose a full screen from a selectable ROM tile+colour layer, add furniture, arm glitter | **paintScreen** (0x0673) |

### HUD / tile plotters / colour
| mechanism | routine(s) |
|---|---|
| Repaint both players' score HUD + status label + tint HUD columns | **redrawScoreHud** (0x472c) |
| Cell geometry: (row,col) → tilemap offset → colour/video write cursors | **rowColToTileOffset** (0x3dae) → **deriveTileWriteCursors** (0x3dc9) |
| Column plotters: copy tile run / capped run down a video column | **copyTileColumn** (0x3dea), **copyCappedTileColumn** (0x3ddb) |
| Colour-column fills (staged / fixed-height / colour-cycling variants) | **fillColourColumn** (0x3e01), **fillColourColumnAt** (0x3e1d), **cycleColumnColour** (0x3e13), **cycleStagedColumnColour** (0x3d7e), **cyclePanelColumnColour** (0x48c4) |
| Fixed panel / label / edge-column painters | **drawPlayerLabel**, **drawMenLeftPanel**, **drawCreditsDisplay**, **drawSetupCreditsPanel**, **drawGameOverLabel**, **drawGameOverText**, **drawSharedPanel**, **drawLeftEdgeColumn**, **drawRightEdgeColumn**, **drawBestScoresTodayLabel**, **drawCopyrightLine**, `loc_4816` |
| Diamond glitter: cycle diamond-cell colours on an 8-frame period | **glitterDiamonds** (0x06ac) |

### Score display / high-score
| mechanism | routine(s) |
|---|---|
| Blank the readout strip, seed 3 zeroed records, render | **initScoreDisplay** (0x4bc7) |
| Lay the three readout numbers into their display cells | **renderScoreReadouts** (0x4cca) |
| Expand a packed score into digit cells (leading-zero blank) | **unpackScoreDigits** (0x4d0c) |
| Insert a candidate into the descending 3-entry "BEST SCORES TODAY" table | **insertHighScore** (0x4d3a) |
| Offer a finishing player's score to the table + repaint readouts | **submitPlayerHighScore** (0x4cbf) |
| Initials-entry screen: build, dial 3 initials, show final readouts | **runHighScoreInitialsEntry** (0x4df8); per-frame handler **stepHighScoreInitialsEntry** (0x4eea) |
| Step the initials cyclic index up / down (range 10..35, off = 255, + sound 8) | **advanceInitialUp** (0x4f38) / **stepInitialDown** (0x4f26) |

### Sound
| mechanism | routine(s) |
|---|---|
| Append a command to the 8-slot sound ring (set high bit, advance head) | **enqueueSoundCommand** (0x4ca5) |
| 19 thin sound-trigger stubs, one per command index | **requestSound2..21** (minus 1 & 14) |
| Master sound-enable / mute control line | **enableSound** (0x4c4d) / **disableSound** (0x4c47) |

### DSW → params · PRNG · frame-IRQ mask
| mechanism | routine(s) |
|---|---|
| Read cabinet DIP switches, fan bits into the gameplay-parameter block + flip-screen lines | **applyDipSwitches** (0x4b55) |
| 16-bit LFSR PRNG (shift-right, feedback = low bit1⊕bit2, reseed if zero) | **advanceRandom** (0x4b1a) |
| Vblank-interrupt mask on / off | **enableNmi** (0x4b14) / **disableFrameInterrupt** (0x4b10) |
| Reset the score bytes + sound queue to zero | **resetScoreAndSoundQueue** (0x4bea) |
| Power-on entry vector | **resetVector** (0x0000) → **coldBootInit** (0x01a4) |

### Render (board layer — `boards/thepit/video.js`)
| mechanism | function |
|---|---|
| 32-byte colour PROM → 40 pens (32 tile/sprite + 8 synthetic bg) | `decodePalette` |
| 2bpp char / 16×16 sprite pixel decode | `charPixel`, `spritePixel` |
| 5-layer compose: lo-pri solid bg → fg tiles → lo-pri sprites → hi-pri solid bg (over sprites) → hi-pri sprites; per-column Y scroll; ROT90 | `renderFrame` |

---

## RAM roles (from `ram.js`, 140 named cells)

Grouped by subsystem; confidence tags carried from `ram.js`.

**Credit / coin / mode**
`CREDIT_COUNT` 0x8000 + mirrors `CREDIT_MIRROR_A` 0x801c / `CREDIT_MIRROR_B` 0x812c
(triple-redundant, watchdog-checked); `COIN_SW_ACCUM` 0x8003, `START1_SW_ACCUM` 0x8004,
`START2_SW_ACCUM` 0x8005 (edge accumulators, 0x55/0xaa); `GAME_MODE` 0x8001 (player-count /
mode gate — dual-use, *(fair)*); `GAME_STATE2` 0x8002 (secondary state / selected-player);
`VARIANT` 0x8048 *(weak — also the high-score landed-rank in some routines)*.

**Input debounce** `IN0_DEBOUNCED` 0x8018 / `IN0_PREV` 0x8019 (joystick+dig);
`IN1_DEBOUNCED` 0x8015 / `IN1_PREV` 0x8016 (coin/start). All *(strong)*.

**Timers / counters** `FRAME_WAIT_COUNTDOWN` 0x8009, `FRAME_COUNTER` 0x8010,
`FRAME_COUNTER_PRESCALER` 0x8007, `MAIN_LOOP_DELAY` 0x8011, `LOOP_COUNTER` 0x800a,
`GLITTER_COUNTDOWN` 0x805c.

**Round / difficulty** `LEVEL` 0x8028 *(strong; every difficulty subsystem scales off it)*;
`MEN_LEFT` 0x802b (P1/P2 backups 0x802c/0x802d kept hex); `STEP_TIMER_BASE` 0x804f;
`LOOP_DELAY_BASE` 0x804e; `STARTING_MEN` 0x8053; `COINS_PER_CREDIT_A/B` 0x804c/0x804d;
`SPRITE_COORD_BIAS` 0x8051 (flip-screen pixel bias, 0 upright).

**PRNG** `PRNG_LOW` 0x800d (also the returned draw) / `PRNG_HIGH` 0x800e.

**Sound ring** `SOUND_HEAD` 0x801e (write idx), `SOUND_TAIL` 0x801f (read idx),
`SOUND_RING` 0x8020 (8 slots).

**Tracked object (the player-digger)** probe point `OBJ_X` 0x8068 / `OBJ_Y` 0x806b;
per-frame steps `OBJ_STEP_X` 0x806c / `OBJ_STEP_Y` 0x806d; packed phase/command
`OBJECT_PHASE` 0x801a; sprite `SPRITE_CODE` 0x8069, attr `OBJ_SPRITE_ATTR` 0x806a;
tile cell `OBJ_TILE_COL` 0x8071 / `OBJ_TILE_ROW` 0x8073, VRAM cell `ACTOR_CELL_PTR` 0x806e;
control block `OBJECT_ACTIVE` 0x8079, busy 0x807a, `SPAWN_PHASE` 0x807b,
`STATE_TIMER` 0x807c, post-timer mode 0x807d; `CLIMB_GATE` 0x8080 *(weak)*;
carve seams `CARVE_SEAM_LEFT` 0x807e / `CARVE_SEAM_RIGHT` 0x807f *(L/R axis under ROT90
unconfirmed)*.

**Tile classifier scratch** `CUR_TILE` 0x80a5, `EXPECTED_TILE` 0x80a7, `NEXT_TILE` 0x80a8;
under-tile latches `GOAL_TILE_LATCH` 0x80e7 (0x27) / `FEATURE_TILE_LATCH` 0x8076 (0x26 —
adversarial review corrected this from 0x27) / `GOAL_CROSSING_LATCH` 0x8077.

**Reaction state machine** `REACTION_STATE` 0x80a2 (0=idle, 1..4 armed), `REACTION_TIMER`
0x80a4, `REACTION_OBJ_X/Y` 0x8094/0x8097, `REACTION_OBJ_CODE` 0x8095, `REACTION_OBJ_ATTR`
0x8096; scroll walker `SCROLL_WINDOW_PTR` 0x809a, `SCROLL_SUBPHASE` 0x809e.

**Loot / score / high-score** `LOOT_10PT_COUNT` 0x8081, `LOOT_20PT_COUNT` 0x8082;
`SCORE_LO` 0x8031 / `SCORE_HI` 0x8034 (packed BCD); `SCORE_DISPLAY_LOW/HIGH` 0x8037/0x8038
(16-bit staging for the digit unpacker); `HIGH_SCORE_TABLE` 0x8039 (3× 5-byte records);
`INITIALS_REMAINING` 0x804b.

**Dig object** `DIG_OBJ_STATE` 0x80aa, `DIG_OBJ_ATTR` 0x80ab, `DIG_OBJ_TIMER` 0x80b1,
`DIG_OBJ_SUBTYPE` 0x80c0, `DIG_OBJ_ARM_STATE` 0x80c1, `SPAWN_STATE` 0x80bd;
target `TARGET_X` 0x80a9 / `TARGET_Y` 0x80ac; staging block `STAGED_TARGET_X/Y`
0x80b6/0x80b9, `STAGED_CELL_PTR` 0x80ba, `STAGED_DIG_TIMER` 0x80bc, `STAGED_DIG_SPRITE_ID`
0x80bf; `DIG_SPAWN_QUEUE` 0x80c3 (24 slots).

**Object movers (OBJ1/OBJ2 + working block)** `OBJ1_X` 0x80e8, `OBJ1_SPRITE_CODE` 0x80e9,
`OBJ1_ATTR` 0x80ea, `OBJ1_TIMER` 0x80f0, `OBJ1_STATE` 0x80f5, `OBJ1_MOVE_PERIOD` 0x80f6,
`OBJ1_TARGET_COL` 0x80f8; `OBJ2_X` 0x80f9, `OBJ2_TILE` 0x80fa, `OBJ2_ATTR` 0x80fb,
`OBJ2_TIMER` 0x8101, `OBJ2_STATE` 0x8106, `OBJ2_MOVE_PERIOD` 0x8107, `OBJ2_TARGET_COL`
0x8109; working-block `MOVER_STATE` 0x8090 (signed sign-dispatch), `MOVER_MOVE_PERIOD`
0x8091, `MOVER_DIRECTION` 0x8092, `MOVER_TARGET_COL` 0x8093; probe `PROBE_CELL_PTR` 0x8089,
`SUBTILE_PHASE` 0x808d, `SAVED_CELL_PTR` 0x8134; `ANIM_RAND` 0x808b (dwell/cadence — *(weak)*
dual-use), `ACTOR_STATE` 0x8084 *(weak)*.

**Two-sprite actor** primary `ACTOR_X` 0x810a / `ACTOR_TILE` 0x810b / `ACTOR_ATTR` 0x810c /
`ACTOR_Y` 0x810d / `ACTOR_STEP_X` 0x810e / `ACTOR_STEP_Y` 0x810f / `ACTOR_TIMER` 0x8112;
twin `TWIN_X` 0x811b / `TWIN_TILE` 0x811c / `TWIN_ATTR` 0x811d / `TWIN_CLEAR` 0x811e /
`TWIN_TIMER` 0x8123; sprite slots `ACTOR_SPRITE_SLOT` 0x8238 / `TWIN_SPRITE_SLOT` 0x823c.

**Background sprite** `BG_SPRITE_X` 0x80db, `BG_SPRITE_FRAME` 0x80dc, `BG_SPRITE_ATTR`
0x80dd, `BG_SPRITE_Y` 0x80de. **Reveal** `ANIM_PHASE_COUNTER` 0x80e3, `REVEAL_PERIOD`
0x80e4, `REVEAL_GATE` 0x80e5, `REVEAL_CURSOR` 0x80e6. **Column anim**
`COLUMN_ANIM_WRITE_PTR` 0x8065, `COLUMN_ANIM_TIMER` 0x8067.

**Tile-plot geometry** `TILE_COL` 0x8058, `TILE_ROW` 0x8059, `TILEMAP_OFFSET` 0x805a,
`COLOUR_RAM_CURSOR` 0x805e, `PLOT_RUN_LENGTH` 0x8055; `BOARD_MODE` 0x8057 *(fair — also
misused elsewhere as a colour byte; several painters keep it hex to avoid the misfit)*.

**Sprite staging** `SPRITE_STAGING_BASE` 0x8220 (32 bytes → hardware sprite RAM each frame);
`SCORE_READOUT_STRIP` 0x8280; `DEMO_STEER_DIR` 0x801b (one-hot demo direction, *(strong)*).

Display-side regions (outside the `0x8000`–`0x87ff` work-RAM ram.js covers, so kept hex):
tilemap `0x9000`–`0x93ff`, colour RAM `0x8800`–`0x8bff`, attribute/column-scroll
`0x9800`–`0x983f`, hardware sprite RAM `0x9840`–`0x985f`; I/O latches `0xb000` (IRQ mask),
`0xb003` (sound-enable), `0xb800` (watchdog/sound), `0xa000`/`0xa800` (input ports).

---

## Resolved (what this map pins down)

- **The whole control-flow spine**: reset → cold boot → the fork at `loc_01f9` → attract
  demo vs credit vs play → the never-returning `mainLoop`, and the vblank NMI's exact
  per-frame service order. All memory-equivalent to the oracle.
- **Scoring is real and complete**: two loot kinds (+10 tile 58, +20 tiles 59..61), the
  BCD scorer, per-player packed score, leading-zero-blanked digit render, and the
  "BEST SCORES TODAY" table with initials entry.
- **The credit/coin economy**: triple-redundant watchdog counter, edge-detected coin/start
  switches, DSW coins-per-credit and free-play.
- **DSW fan-out**: bonus/lives, per-step difficulty timer, starting men, flip-screen /
  cocktail, and the top-bit colour-test screen.
- **Difficulty scales off `LEVEL`**: `MAIN_LOOP_DELAY`, the column-anim timer
  (`STEP_TIMER_BASE − 4·LEVEL`), reveal period, and the mover cadences all get faster.
- **The sprite pipeline**: everything stages into `0x8220`, the NMI blits it to `0x9840`.
- **The actor architecture**: the "twin" is a rigid +16px second sprite = one ~32px figure,
  not a shadow entity; distinct from the tracked-object player path and the OBJ1/OBJ2 movers.
- **The render model**: 5-layer priority compose, per-column scroll, ROT90, the synthetic
  bg pens, and the sprite clip band — all in `video.js`, pixel-checked on attract.

## Open questions (honest unknowns)

- **The object/mover on-screen axis under ROT90** is *unpinned*: `OBJ_STEP_X` vs
  `OBJ_STEP_Y`, the "row/column" labels, and `CARVE_SEAM_LEFT/RIGHT` may be swapped
  relative to what the player sees. This is why the whole mover/probe cluster
  (`loc_319d`, `loc_3476/347d/3484/348b`, `loc_33bc/33da/3410/3425`) keeps neutral names.
- **Win / lose conditions** are not directly observed. Code shows: caught-by-mover in the
  "player box" arms a death pose + hands off to a round transition (`loc_3458` → `loc_0278`);
  `loc_13c9` expiry routes to either `loc_0278` (lost life?) or `advanceToNextLevel`
  (level cleared?); `showBonusScreen` reads `LOOT_10PT_COUNT==4`/`LOOT_20PT_COUNT==3` as a
  completion tally. The exact trigger for "level complete" (collect all loot? reach the
  goal tile 0x27?) is **[guess]**.
- **What the goal tile 0x27 / feature tile 0x26 represent** in game terms (surfacing, a
  wall, an exit) — mechanism clear, meaning **[guess]**.
- **The bottom "creatures"** and the **"ZUN…" label** — raw ROM tile strips, never decoded.
- **Which actor each figure is** (player vs enemy vs UFO) for the two-sprite actor and the
  alt-phase / twin spawners — the code drives them precisely, but their game identity is
  **[guess]** (names kept `loc_`/neutral for exactly this reason).
- **Several `(weak)`/`(fair)` RAM names** (`ANIM_RAND` 0x808b dual-use, `ACTOR_STATE` 0x8084,
  `CLIMB_GATE` 0x8080, `VARIANT`/landed-rank 0x8048) have not had the adversarial
  re-derivation the DK names got; verify before trusting.
- **Sound command → actual noise** mapping is unknown: the 19 stubs are identified by their
  command *index* only (no audio oracle exists).

---

## Pixel-testing / validation status

- **Boot → attract renders pixel-exact vs MAME** across the full attract path
  (~**302/304** frames per the render harness): the tilemap layer is verified 0-diff
  (`video.js`: "Verified pixel-exact vs MAME (0/57344)" per frame), and the sprite path
  (origin, the −16 visible-area vtop, the flip math, the left-column clip band) was
  confirmed against a gameplay input-tape golden — **enemy/creature sprites in the bottom
  band matched MAME to the pixel** once the −16 offset and the clip rectangle were applied
  (the "fish appears in JS only" clip bug is fixed). This is the **[seen]** surface.
- **Gameplay sprites are only partially confirmed**: the attract demo never digs deep,
  never scores, never wins or loses, so the dig/carve, loot-collect, reaction, win/lose and
  bonus-screen paths are **memory-equivalent to the oracle but not frame-validated in play**
  — each is gated by crafted entries rather than a natural attract dispatch. Treat all
  deep-gameplay behaviour as **[code]**, not **[seen]**.
- **`video.js` itself is the only ungated surface** (hand-transcribed from `roundup.cpp`,
  attract-validated); its header flags flip-screen math, exact sprite origin, and the clip
  rectangle as the areas most in need of continued pixel confirmation vs MAME.
