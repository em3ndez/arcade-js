# Frogger — how the machine actually works

A code-grounded model of Konami's Frogger (`frogger`, 1981), built from the translated ROM, the
routines the idiomatic layer has rewritten, and the real machine under MAME. Its companion is
`gameplay.md`, which describes the same game from the outside, blind to the code. This document
answers what the code can settle and is honest about what it cannot.

Three decompile batches are lifted and grounded: batch 1 (the status/display and game-state plumbing),
batch 2 (the scroll engine, the home-bay animations, and the sprite-object arms), and batch 3 (the
sprite-object spawn/motion engine, the frog's horizontal-move resolver and render, the per-frame scroll
and frog-hop continuation, player-swap and board lifecycle, and the score/HUD tile builders). The frog's
hop input *scan* (`0x1acb`) is now lifted as **`scanFrogInputAndDispatchHop`** (see The frog hop),
dissolving the eight hop handlers and the home-slot cursor. This revision was **folded**, not rewritten
whole from `gameplay.md` — a full blind rewrite is owed and this note records that debt.

**Batch 4** lifted and grounded the four ready dispatchers, now named: **`stampHomeBayFrogByColumn`**
(the board-complete home reveal), **`writePackedBcdWord`** (the four-digit BCD field printer),
**`dispatchFrogMoveAgainstLanes`** (the lower-half move dispatcher), and **`updateSpriteObject`** (the
sprite-object dispatcher-B). They dissolve their calls into the already-lifted arms.

**Batch 5 + UP-5** lifted and grounded the last two ready near-leaf routines: **`writeScoreField`**
(prints a packed-BCD score word plus a fixed trailing zero as a 5-cell tilemap readout) and
**`renderMode4PointTablePhase`** (draws one phase per call of the mode-4 attract "-POINT TABLE-" screen —
the FROGGER logo, 10/50/1000 PTS lines, KONAMI (c) 1981 — stepping a phase counter 4..0). Grounding
confirmed the reused cells `0x83d7`/`0x83d8`/`0x801b`/`OBJECT_ANIM_STATE_8021`/`0x8023`/`0x802f` are genuine MULTI-PURPOSE
reuse — the same work RAM used differently per game mode, not misreads — so each keeps both roles in `names.js`.

**Batch 6 + UP-6** lifted and grounded the last near-leaf routine: **`renderMode3ScoreRankingScreen`**
(draws the mode-3 attract "SCORE RANKING" screen in one call — the FROGGER logo, the "SCORE RANKING"
header, five ranked high scores (1ST 04630 PTS .. 5TH 01270 PTS) read from the high-score word table
`HIGH_SCORE_TABLE_BASE` (`0x83f1`-`0x83fa`), KONAMI (c) 1981). It dissolves its five lifted callees and keeps a single `m.call`
to the shared final-strip tail — the layer's first kept `m.call`, legitimate because that tail is
unlifted and independently entered by the mode dispatcher. Grounding confirmed the " PTS" suffix strip
`PTS_SUFFIX_STRIP` is SHARED across the mode-3 ranking and mode-4 point-table screens (lifted `[code]`→`[seen]`,
role generalized), and grounded the work cells it touches (`OBJECT_ANIM_STATE_8019` seed; the `OBJECT_ANIM_STATE_801F`-based 4-strided
object-clear; the `SCORE_RANKING_HEADER_STRIP` header source). With this the near-leaf frontier is exhausted — what remains
is the spine core.

**Batch 7 + UP-7** lifted and grounded the four held-back service routines: **`renderScoreHeader`**
(redraws the three-column score header each frame — the HI-SCORE column, the "1-UP" player-1 column, and,
in two-player mode, the "2-UP" player-2 column), **`renderCreditLine`** (draws the "CREDIT" line — a
one-time column clear latched by `CREDIT_COLUMN_CLEAR_LATCH`, the "CREDIT" label from `CREDIT_LABEL_STRIP`, and the packed-BCD credit
count `0x83e1`), **`initNewGameScoreAndTimers`** (new-game reset: zeros both players' score words and the
extra-life-awarded flags `PLAYER1_EXTRA_LIFE_AWARDED`/`0x83e8`, then copies the start-time byte `SHARED_TIME_BYTE` into both
time-remaining bytes so both time bars begin full), and **`clearSoundQueue`** (zeros the 48-byte
sound-command queue `0x8300`-`0x832f` at game start). Grounding **corrected the score layout**: the
on-screen "HI-SCORE" and "1-UP" glyphs pin `HIGH_SCORE` (`0x83ef`) as the **high score** and
`PLAYER1_SCORE` (`0x83ed`) as the **player-1** score — the two were swapped in the code-only reading
(`PLAYER2_SCORE` is player 2, already right) — so `packScoreRankPair` ranks *both players'* scores, not
"P2 + high". It also **overturned** `OBJRAM_COL3F_ATTR_SHADOW`:
not a page-swap/display flag but the work-RAM shadow of the object RAM's per-column attribute byte
`0xB03F`, DMA-copied into object RAM each frame and only ever *written* by the display routines. A
grounder's proposal that `0x83e5`/`0x83e6` are **lives** was **rejected** — `renderTimeBar` reads them to
draw the time bar, so they are the per-player time-remaining bytes (the real lives are `0x83b7`-`0x83b9`).

**Confidence tags, not decoration:**
- **`[seen]`** — observed on the real ROM under MAME; **`[seen,poked]`** when the trigger was forced by
  a memory poke rather than natural play (the reading is real, the path was forced).
- **`[code]`** — from a translated routine's behaviour; mechanics exact, role inference, MAME did not
  exercise it.
- **`[guess]`** — plausible, unverified.

A role is `[seen]` only if its evidence terminates in MAME, never our own engine. Where grounding
overturned a code-only reading, the map says so. Data cells carry a tag too, not only routines: a cell
is `[seen]` once MAME confirms its role (see the data-name registry in `names.js`).

## The frame and the engine — `[code]`; rendering fidelity `[seen]`

Galaxian/Scramble-derived Konami hardware: a tilemap background with hardware sprites, an 8255 PPI for
inputs/DIPs and the sound-command latch, and a second Z80 + AY-3-8910 for sound. The idiomatic layer
runs its rewritten routines in place of the frozen translated oracle, born live: the whole gameplay
spine — the vblank NMI handler **`serviceVblankNmi`** (`0x0066`), the boot chain, the in-play update
**`driveInPlayFrameUpdate`**, the collision orchestrator **`orchestrateCollisionsAndFrogInput`**, and the
home-bay goal handlers **`selectHomeBayGoalHandler`**/**`awardHomeBayGoal`** — is wired as live overrides
and seats through coin/play/hop/death/game-over/goal under an input-tape replay. Seating a routine as an
override needs its net stack effect to be one `ret` (or a caller-skip that lands on the caller's slot);
several routines reached that only after their **unbalanced tail-calls into still-translated helpers**
(the scroll-copy alt entry, the collision-cell clear, the frog-kill tail, and the goal-award caller-skip)
were **dissolved** — the helper lifted and the tail-call turned into a direct JS call so no stray `ret`
drifts the stack. Balanced trampolines (a `push16` sentinel the callee's `ret` consumes) correctly stay
dispatched by address. The frame boundary is a vblank yield, not a cycle count, re-entering at the pace
tail (`0x0368`). Rendered idiomatic frames match a fresh MAME golden to **0px** at the boot landmark —
`[seen]` the port is pixel-faithful there.
At cold boot **`spinWatchdogSettleDelay`** feeds the watchdog by strobing the I/O port at `0x8800`
(non-RAM: writes read back `0xFF`) from a `BC=0xEFFF` settle loop — `[seen,poked]`.

## The scrolling background and river lanes — `[seen]`

The river/road background scrolls, driven from the NMI. **`advanceScrollLaneObjects`** is the per-vblank
scroll tick: it copies each of the two scroll descriptors into its shadow, steps counter A by 1 (firing
**`stampScrollRevealColumn`** at its threshold) and B by 2 (firing **`blitScrollBand`**), advances the
scroll phase, and at phase 16/32/48 feeds object A's descriptor into **`blitScrollTileGrid`** and object
B's into its alt entry **`blitScrollTileGridAlt`** (the same copy loop, differing only in the alt
destination-base cell; phase 48 also zeroes the phase). `blitScrollTileGrid` stamps tile pairs (`0x34`–`0x37`) down VRAM columns from
`0xA808`; `stampScrollRevealColumn` writes the newly-revealed edge column into `VRAM_BASE`; `blitScrollBand`
writes the scrolling band rows. **`blitFourTileGroupColumn`** paints 14-row two-wide columns of the
four-tile group (tiles `72`–`75`) — the **river-log** graphics. **`advanceAttractDemoFrogHop`** (`0x23b7`, a
wave-1 misnomer now corrected) is the ATTRACT-DEMO scripted-hop continuation. MAME grounding
(2026-08-16, wave 2) recorded it running **zero** times across real land hops but on every attract-demo
frame (GAME_MODE==1, PLAY_FLAG==0), paired 1:1 with **`driveAttractDemoFrogHop`** (`0x236d`)
which begins the demo frog's scripted hops via the script table at `0x2E68`.
So in *real* play the hop continuation is done by **`scanFrogInputAndDispatchHop`** calling the advance
handlers directly (the wave-1 river-object-carry hypothesis is falsified — `0x23b7`/`0x236d` drive only the
attract demo). The log/turtle carry is **`moveLaneObjectsAndCarryFrog`** (see The lane-object mover).

## The frog hop — `[seen]` (all four directions MAME-grounded 2026-08-16)

The joystick input scan — **`scanFrogInputAndDispatchHop`** (`0x1acb`) — reads the input ports each
vblank with the frog X/Y cursors armed and, on a directional press, dispatches one of four **begin**
handlers in **`animateFrogHop`** — DOWN (`0x1b8b`), UP (`0x1be4`), RIGHT (`0x1c41`), LEFT (`0x1ca0`) —
while a direction already mid-hop tail-dispatches its **advance** half instead and an idle direction has
its arrival + animation-counter cells cleared. UP is skipped once RIGHT or LEFT is already hopping.
Player routing keys on `IN2` bit 3 (cocktail) together with `ACTIVE_PLAYER`: RIGHT/LEFT read the player's
main port (P1 `IN0`, P2 `IN1`) bits 4/5, while DOWN/UP sit on `IN2` for P1 (bits 6/4) but cross to `IN2`
bit 0 / `IN0` bit 0 for P2. While the hop-input lock timer (`FROG_HOP_INPUT_TIMER`, `0x8268`) counts it
decrements the timer and ticks the home-slot cursor (`loc_23eb`) instead, locking new input; a set
`GATED_COUNTDOWN_ENABLE_FLAG` or `HOLD_FLAG` returns at once. The lift dissolves all eight hop handlers and `loc_23eb`. A begin guards on the frog's position (screen edges), emits the hop sound, stamps the
direction's rest tile into `FROG_SPRITE_CODE`, and primes that direction's `FROG_HOP_*_ANIM_COUNTER` from
its `FROG_HOP_*_ANIM_RELOAD`, then falls into the matching **advance** half. An advance ticks the counter
down and, on drain, marks the hop's arrival and stamps the rest tile; otherwise it steps the hopping frog
by `FROG_HOP_VERTICAL_DELTA` (DOWN → `FROG_Y +`, UP → `FROG_Y -`) or `FROG_HOP_HORIZONTAL_DELTA` (RIGHT →
`FROG_X +`, LEFT → `FROG_X -`) and stamps the moving tile. Over the reload count of frames the frog advances
one 16px cell (~2px/frame). The hop continuation is driven by `scanFrogInputAndDispatchHop` itself, which
tails to the active direction's advance half each vblank (the separate `advanceAttractDemoFrogHop` at
`0x23b7` drives only the attract-demo frog, not real play — see the render section). The UP advance also steps the
home-slot cursor (`loc_23eb`) and scores via **`scoreFrogRowProgress`** (`0x1fd6`), which range-checks
`FROG_Y` to [0x30,0xd0] and awards a point when the frog reaches a new furthest (`FROG_FURTHEST_ROW`) row
through the unlifted score routine (`0x08e0`, kept `m.call`). `[seen]` for the vertical hop (golden_hop: the
UP hop steps `FROG_Y` 0xe0→0xd0 at -2/frame over 8 frames, counter 8→0, arrival set) and the right hop
(golden_hop2: the RIGHT hop steps `FROG_X` 0x80→0x8e at +2/frame, cut short by a road collision before
drain); the DOWN and LEFT directions share the same handler body but were not exercised in the goldens, so
they stay `[code]`. Every branch is equivalence-verified against the oracle (poked hop state + teeth).

## The home bays — `[seen]`

The five top bays are the goal, and the code that decorates them is a small animation engine keyed by a
slot cursor. **`loc_23eb`** advances the `HOME_BAY_SLOT_CURSOR` slot cursor mod-6, read by the stampers as the
home-slot index 1..5 (grounding **overturned** the earlier "river/lane-scroll phase" reading). Into a
bay whose occupancy flag is clear, the engine stamps one of several creatures at that bay's fixed VRAM
base (`HOME_SLOT5_VRAM`/`HOME_SLOT4_VRAM`/`HOME_SLOT3_VRAM`/`HOME_SLOT2_VRAM`/`HOME_SLOT1_VRAM`): **`stampHomeBayFly`** the fly bonus creature,
**`stampHomeBayGatorEmerging`** then **`stampHomeBayGatorFull`** the crocodile hazard across two phases.
When the frog reaches a bay, **`stampHomeBaySlot`** stamps the resting-frog block and **`armHomeGoalSprite`**
arms the goal/bonus sprite. On board completion **`stampHomeBayFrogByColumn`** reveals the five homes in sequence: driven by the
reveal countdown `HOME_REVEAL_COUNTDOWN` (set to 255 by `loc_05d3`, decremented each frame), each selector threshold
stamps the 2x2 frog-in-home graphic (tiles `0xFC`-`0xFF`) into the next bay; the final `A==0x10` selector
delegates to **`fillAllHomeSlotsAndAwardLife`**, which resets all five bays to the empty home tile `0x10`
and awards the extra life. Grounding inverted the code-only reading — `0xFC`-`0xFF` is the frog graphic,
`0x10` the empty bay. All `[seen]`/`[seen,poked]`.

## The frog — move resolution and render — `[seen]`

**`resolveFrogMoveAgainstLanes`** is the upper half of the horizontal-move dispatcher
(**`dispatchFrogMoveAgainstLanes`**, the lower half, dispatches here): the frog X selects one of sixteen arms through the `0x130b` pointer table; ten arms scan a lane's
object list for an object inside the frog's move band and set the block/hit flag `HOLD_FLAG`, while a clear
lane with the frog not-yet-across calls the lifted **`killFrogAtLane`** (the `0x12d0` kill tail: raise
`HOLD_FLAG`, and in the mid-river band also set the second-bank kill cell). **`renderFrogAndArmObjects`**
draws the frog figure into the tilemap (three 4-tile column groups, the banner column, four box corners,
the home-marker string via `blitFourTileGroupColumn`), raises the three object-ready flags
(`OBJECT_READY_0`/`OBJECT_READY_1`/`OBJECT_READY_2`), then tail-chains `seedObjectAnimationState`. **`renderFrogAnimArm0`**, **`renderFrogAnimArm1`** and
**`renderFrogAnimArm6`** are arms of the `0x0faf` frog-animation dispatcher: each loads its sprite
triple, points at the pattern table, arms the IX/IY plot cursors at a lane list, stashes the sprite
code, and enters the shared render loop `FROG_ANIM_RENDER_LOOP` (arm 1 first runs the guarded pre-blit
`blitFrogAnimColumnOnTrigger`). Arm 0's outgoing register ABI to that loop is a return-bridge and its
pattern pointers (`FROG_ANIM_ARM0_DEST_PTR`/`FROG_ANIM_ARM0_SRC_BASE`) are named cells. `[seen]`.

## The sprite-object engine — `[seen,poked]`

An IX/IY sprite-object engine drives the moving hazards through two dispatchers. Dispatcher-B
(**`updateSpriteObject`**) is a spawn-and-run pipeline: **`spawnSpriteObject`** (gated on level count `0x83b7>=3` and an
idle record) makes four **`nextSpawnRandomByte`** draws to density-gate the spawn, pick one of five
variants, and fill the record's tile/attribute/position/direction, then arms it; **`steerSpriteObjectTowardTarget`**
counts down the move timer and drifts the object one step toward its per-object target (despawning —
clearing the 16-byte record and the shared block `SPRITE_OBJECT_SLOT_B` — on arrival unless the hold flag `HOLD_FLAG` is
set); **`writeSpriteObjectSlotX`**, **`writeSpriteObjectSlotAttr`** stage the on-screen X and the
state-indexed attribute/code into the IY sprite slot; **`flagSpriteObjectFrogHitAhead`** is the hit test —
on the frog's row, a direction-adjusted position within 16px ahead of the frog X raises `HOLD_FLAG` and marks
the object hit-consumed (state 2). Dispatcher-A's **`placeSpriteObjectSlotAndRetire`** runs the arm helper
(one-shot + arm sound), writes the slot X/attribute/fold-biased position, and on the fold with the retire
flag clears the record and slot. **`driveSpriteObjectCluster`** is the per-frame cluster entry: below
three slots (`LIVES_COUNT`) it skips to dispatcher-B, else it runs dispatcher-A **`dispatchSpriteObjectArmsA`**
on the active player's record — a second pass advancing to the next record/slot only at six slots — then
dispatcher-B. Dispatcher-A runs its five arms in order, the first being **`spawnSpriteObjectArmA`** (the
spawn arm: on the spawn-timer expiry with an idle object it rolls the spawn PRNG against `8*count+0x80`
and walks the `SPRITE_SPAWN_X_STRIDE`/`SPRITE_SPAWN_BAND_SCAN_COUNT` placement bands down from `FREE_RUNNING_POS_COUNTER` to land the object
on-screen or park it off-screen, seeds its timers, then falls into the shared arm tail); `[code]`. The
batch-2 arms **`animateSpriteObjectFrame`**, **`loc_29f9`** (a motion
arm whose earlier toward-the-frog name was reverted — `FREE_RUNNING_POS_COUNTER` grounded as a free-running
counter, not the frog X, so the object drifts toward that counter), **`flagSpriteObjectFrogHit`** and the
fly's **`driveFlyPatrol`** remain as described in `names.js`. All
`[seen]`/`[seen,poked]` (a game poked to reach the spawn).

**Fly appearance is clocked by a drifting counter (`FLY_DRIFT_COUNTER`, `0x811c`)** — grounded 2026-08-16
under MAME (stage-B, wave 1). The generic block-mover advances the byte +1 roughly every six frames,
wrapping `0xFF`→`0x00` on a ~1536-frame (~25.6 s) period; **`animateFlyEatCollision`** arms the fly tongue
exactly when it reads `0`, so the wrap **is** the fly's spawn trigger, and `driveFlyPatrol` then adds the
same drifting byte as the fly sprite's X base (the patrol anchors to it). This overturns the earlier
`[code]` reading of `0x811c` as a static "fly path X base". (Also grounded this wave and now `[seen]`: the
frog-object/reset/score cells, the scroll/lane-render and animation-frame cells, and the countdown/HUD
cells — via the real-ROM write/read taps in `scratchpad/*gnd*.lua`. Attract companion `0x83bb` is
write-only-to-0 with no functional read — the only read is the cold-boot LDIR work-RAM zero-fill (0x02ba)
that sweeps it as a source — so it carries no sequencer state.)

## The two-pair figure (rideable) — `[seen,poked]`

A rideable "two-pair" figure at VRAM `TWO_PAIR_FIGURE_VRAM` has its own small state machine. **`armTwoPairFigureFrame`**
is a one-shot: when the busy latch `SPRITE_FRAME_BUSY_LATCH1` is clear it raises the step gate `FIGURE_ANIM_STEP_GATE`, seeds the two
frame cells `TWOPLAYER_FRAME_CELL_8146`/`TWOPLAYER_FRAME_CELL_8147` from `(ANIM_FRAME_BUFFER & 0x0f)*8`, and sets the busy latch. **`loc_27ea`** is the
per-frame driver, dispatching on the count `0x83b7` to two dedicated arms at the extremes (kept `loc_` —
the two blind derivers split on whether it is turtle-dive-specific or a generic figure clock, and MAME
did not settle which). **`mountOrKillFrogOnTwoPairFigure`** (gated on `FIGURE_ANIM_STEP_GATE` bit0 and phase `0x83b7>=2`)
box-tests the frog against the figure: an inner overlap tail-kills the frog (`0x12d0`), an outer overlap
mounts it — stamps the 2×2 mount-tile quad (104..107) at `TWO_PAIR_FIGURE_VRAM` and sets the ride flag `HOLD_FLAG`.
**`clearLatchedCollision`** is the guarded reset: when the collision latch `COLLISION_LATCH` is set it zeroes the
sub-flag `COLLISION_SUBFLAG` and falls into **`clearCollisionSpriteBlock`**, the shared cell-clearing helper (now
lifted and dispatched) that zeroes the four-byte fly/goal sprite block `0x8040`–`0x8043` and the collision latch;
`stampHomeGoalAndResetFrog` dispatches the same helper directly after a latched hit is scored. `[seen,poked]`.

## Board setup and player lifecycle — `[seen]`

At board start **`loadActivePlayerLaneParams`** LDIRs the active player's 33-byte lane-parameter block
into `0x8270`; **`seedObjectAnimationState`** fills the object seed tables; **`initDisplayFieldOnce`**
(guarded by `0x842d`) lays out the score/bonus display field once (blits a strip, fills a tile-12 column,
seeds the countdown pair `0x83dc`/`0x83de`). **`initInPlayBoardOnce`** is the one-shot in-play board setup
(guarded by `IN_PLAY_BOARD_INIT_GUARD`): it clears the difficulty indices and two board-state cells, runs that lane/object/
field setup, and blits the HUD strings and score-target digits. **`clearActivePlayerWorkRam`** clears the
active player's work RAM (the frog object block and home-bay gates) except in a one-player game, and
**`clearTilemapToTile16`** (the rst-0x38 primitive) blanks the whole 32×32 tilemap. On board advance
**`advanceBoardForeground`** queues two sound cues, bumps the active player's mod-5 difficulty index,
reseeds the score field and lays out the new board, then tails into the score adder with a `0x0100` delta.
`[code]`. In a two-player game the turn transition swaps banks:
**`swapInActivePlayerPages`** banks the live object/work pages out to a save area and restores this
player's pages, writing the OBJRAM per-column attribute shadow `OBJRAM_COL3F_ATTR_SHADOW` (the work-RAM copy of `0xB03F`,
DMA-blitted to object RAM each frame — not a swap/display flag); **`clearPlayerOneHomeBayGates`** zeros player 1's slot byte
`PLAYER1_SLOT` and its five occupancy gates `HOME_BAY1_OCCUPANCY_PRIMARY`–`HOME_BAY5_OCCUPANCY_PRIMARY` on the cold board re-init. **`raiseActivePlayerStartFlag`**
raises the start flag for the active player. `clearFourByteCounterBlock`, `clearTwoPlayerFrameCells`,
`tickGatedCountdown`, `setAttractIdleMode` remain as described in `names.js`. **`stampAttractDemoCell`**
assembles the attract board demo one river-object cell per dwell tick, tailing to `setAttractIdleMode`
when all seven phases are placed. `[seen]`/`[seen,poked]`.

## Status, scoring, and sound — `[seen]`

`renderLivesRow` draws the reserve-frog markers; `renderTimeBar` the col-30 time indicator;
`renderFilledHomeSlots` the filled-bay frogs. `awardExtraLife` awards the extra frog on board completion.
The five-entry descending table at `0x83F2` is the high-score ranking (`insertHighScoreEntry`).
**`writeScoreDigitStepUp`** writes one BCD score digit and steps the VRAM pointer up a row;
**`writePackedBcdByte`** prints one packed-BCD byte as two digits (high nibble then low) via that helper,
leaving HL advanced. **`packScoreRankPair`** ranks both players' scores (`PLAYER1_SCORE` player 1, `PLAYER2_SCORE` player 2) through `insertHighScoreEntry`
and packs the two rank codes into display field `0x83fb`, which **`placeScoreRankMarkers`** then reads,
writing a value-to-position marker (tile 4) into work-RAM page `0x80` — not a rendered numeral (grounding
overturned the "draw digit pair" reading). **`dequeueSoundCommand`** pops the sound-command queue at
`SOUND_QUEUE_COUNT` and issues the front byte through `issueSoundCommand` (latches `SOUND_CMD_LATCH`, pulses `SOUND_CTRL_PORT` bit 3).
**`enqueueSoundCommand`** is the enqueue side (the rst-0x18 primitive): while in play it bumps the ring
head `SOUND_QUEUE_COUNT` and stores the command in `A`, dropping it in attract; the hop, the board-advance
cues, the score-display driver, and **`enqueueLaneScrollSyncedCommand`** (a play-mode enqueue of command
`0xD0`, gated on the lane-control byte `LANE_CONTROL_SPEED_7` and the lane scroll position
`LANE_RUN_SCROLL_POS` — MAME-grounded 2026-08-16 as lane data, NOT frog-on-log state) all feed it. **`scanCoinInputAndCredit`** — run first each
NMI — latches the coin input `COIN_INPUT_LATCH` in attract and credits on the release edge, pulsing the
slot's hardware coin counter (`COIN_COUNTER_0`/`COIN_COUNTER_1`) and adding the `COINAGE_WORD`-indexed
amount to the packed-BCD total `CREDIT_BCD` (clamped at `0x99`), then forces the player-select mode unless
already playing. **`addScoreAndAwardExtraLife`** adds the `DE` BCD delta to the active player's score and,
the first frame it reaches the target `EXTRA_LIFE_SCORE_TARGET` with the award flag
(`PLAYER1_EXTRA_LIFE_AWARDED`/`PLAYER2_EXTRA_LIFE_AWARDED`) clear, awards the one-time bonus (bumping the
`0x83e5`/`0x83e6` counter and stamping the bonus tile up the HUD column). **`driveScoreDisplayCountdown`**
is the per-frame score-display driver, walking a BCD counter down, animating one bar tile, and taking
`blitEndStripAndSetHold`'s end-strip tail on drain. **`clearAndSeedScoreField`** resets the score field for
a new board. `[code]`.
The tile builders: **`blitPlayerSelectPrompt`** draws the player-select prompt — "ONE PLAYER ONLY" on one
credit, else "ONE OR TWO PLAYERS" (grounding overturned the earlier credit/1UP-header reading),
**`blitEndStripAndSetHold`** blits a terminal
strip and raises the hold flag `HOLD_FLAG` to halt the score-display driver, **`blitGameOverLine`** clears a
tile-group column and blits the fixed 9-tile line, and **`renderMode2IntroScreen`** fills the 28×32
playfield and blits the mode-2 title strips. `handOffToOtherPlayer` toggles players. `[seen]`/`[seen,poked]`.

## The lane-object mover — `[seen]`

Each frame **`moveLaneObjectsAndCarryFrog`** walks the eleven lane objects (`LANE_OBJECT_INDEX`, 0..10; the
sixth is a spacer), shifting each object's sprite run and lead sprite by its lane's speed — right or left
per lane, the low nibble of the lane's control byte — unless that object's `LANE_OBJECT_PHASE_TABLE`
countdown is running, which holds it (letting lanes step at a sub-frame rate). When the frog sits in a
moving object's row band and cell-column the shift is applied to `FROG_X` too, so it rides the log/turtle;
`HOLD_FLAG` is raised if the ride carries it off either edge. The eleven arms collapse to an 11-row
parameter table over a shared right/left mover; the ROM's mutual recursion (advance the index, re-enter the
dispatcher) becomes a `for` loop over the objects. `[seen]` — grounded vs MAME (golden_broad, gameplay
f212+): all eleven objects step per frame at their lane's control-nibble sub-rate, the
`LANE_OBJECT_PHASE_TABLE` countdowns reload to nibble−1 and move-on-drain, directions match, and the motion
reaches OBJRAM; the frog-carry branch was not exercised (idle-frog golden) — code-level, not-refuted.

## Not yet named / open

- **`loc_27ea`** — `[seen,poked]` the two-pair-figure per-frame driver above; kept `loc_` (blind derivers
  split turtle-dive vs generic figure clock, MAME did not settle it).
- **`loc_0c4a`** — `[seen]` a work-RAM store (writes `E` to page `0x80` at `0x80(D-C)`); grounding
  overturned the "intro digit tile" reading. Kept `loc_` (grounded role, no converged name). Called by
  `placeScoreRankMarkers`.
- **`loc_23eb`** — `[seen]` the home-bay slot cursor above; kept `loc_` (both blind proposers misread it).
- **`computeVramColumnIndex`** (`0x1198`) — a pure-register leaf returning only `C`; `[code]`, no
  runtime-observable effect to ground.
- `0x0f3e` (`tickAttractCellFrameClock`, a double caller-skip) is now DISSOLVED to a direct boolean call
  by `driveAttractDemoSequencer`, not a kept caller-skip.
- Promoted 5 work-RAM cell names from per-file local consts to names.js exports so each raw literal lives
  once in the registry (`[code]`, grounding pending): `INTRO_TIMER` 0x83c5, `CONTINUE_FLAG` 0x83c9,
  `CONTINUE_FLAG_2P` 0x83ca, `LIFE_RESTART_FLAG` 0x83ce, `HOP_FRAME_COUNTER` 0x8247. (0x83c7 left a local
  const — its role is unconfirmed, write-only in the layer.)
- Now lifted: the frog's hop input scan (**`scanFrogInputAndDispatchHop`**, see The frog hop) and the
  road/river vehicle and log **movement** (see the lane-object mover above).
