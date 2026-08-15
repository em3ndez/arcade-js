# Frogger — how the machine actually works

A code-grounded model of Konami's Frogger (`frogger`, 1981), built from the translated ROM, the
routines the idiomatic layer has rewritten, and the real machine under MAME. Its companion is
`gameplay.md`, which describes the same game from the outside, blind to the code. This document
answers what the code can settle and is honest about what it cannot.

Three decompile batches are lifted and grounded: batch 1 (the status/display and game-state plumbing),
batch 2 (the scroll engine, the home-bay animations, and the sprite-object arms), and batch 3 (the
sprite-object spawn/motion engine, the frog's horizontal-move resolver and render, the per-frame scroll
and river-lane commit, player-swap and board lifecycle, and the score/HUD tile builders). The frog's own
hop input and the road/river vehicle/log movement are still translated-only, so the map is quiet on
those. This revision was **folded**, not rewritten whole from `gameplay.md` — a full blind rewrite is
owed and this note records that debt.

**Batch 4** lifted and grounded the four ready dispatchers, now named: **`stampHomeBayFrogByColumn`**
(the board-complete home reveal), **`writePackedBcdWord`** (the four-digit BCD field printer),
**`dispatchFrogMoveAgainstLanes`** (the lower-half move dispatcher), and **`updateSpriteObject`** (the
sprite-object dispatcher-B). They dissolve their calls into the already-lifted arms.

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
runs its rewritten routines in place of the frozen translated oracle, born live; the frame boundary is
a vblank yield, not a cycle count, re-entering at the pace tail (`0x0368`). Rendered idiomatic frames
match a fresh MAME golden to **0px** at the boot landmark — `[seen]` the port is pixel-faithful there.
At cold boot **`spinWatchdogSettleDelay`** feeds the watchdog by strobing the I/O port at `0x8800`
(non-RAM: writes read back `0xFF`) from a `BC=0xEFFF` settle loop — `[seen,poked]`.

## The scrolling background and river lanes — `[seen]`

The river/road background scrolls, driven from the NMI. **`advanceScrollLaneObjects`** is the per-vblank
scroll tick: it copies each of the two scroll descriptors into its shadow, steps counter A by 1 (firing
**`stampScrollRevealColumn`** at its threshold) and B by 2 (firing **`blitScrollBand`**), advances the
scroll phase, and at phase 16/32/48 re-blits both lane tile grids via **`blitScrollTileGrid`** (phase 48
also zeroes the phase). `blitScrollTileGrid` stamps tile pairs (`0x34`–`0x37`) down VRAM columns from
`0xA808`; `stampScrollRevealColumn` writes the newly-revealed edge column into `0xA800`; `blitScrollBand`
writes the scrolling band rows. **`blitFourTileGroupColumn`** paints 14-row two-wide columns of the
four-tile group (tiles `72`–`75`) — the **river-log** graphics. **`commitRiverLaneArrivals`** runs each
frame with HL/DE pointed at the frog X/Y cells: for each of four ride lanes it tail-calls that lane's
commit handler when the lane's direction flag (`0x8248`–`0x824b`) is set, else clears the lane's arrival
mirror (`0x824c`–`0x824f`) — this is how a log/turtle carries the frog. All `[seen]`.

## The home bays — `[seen]`

The five top bays are the goal, and the code that decorates them is a small animation engine keyed by a
slot cursor. **`loc_23eb`** advances the `loc_8123` slot cursor mod-6, read by the stampers as the
home-slot index 1..5 (grounding **overturned** the earlier "river/lane-scroll phase" reading). Into a
bay whose occupancy flag is clear, the engine stamps one of several creatures at that bay's fixed VRAM
base (`0xA864`/`0xA924`/`0xA9E4`/`0xAAA4`/`0xAB64`): **`stampHomeBayFly`** the fly bonus creature,
**`stampHomeBayGatorEmerging`** then **`stampHomeBayGatorFull`** the crocodile hazard across two phases.
When the frog reaches a bay, **`stampHomeBaySlot`** stamps the resting-frog block and **`armHomeGoalSprite`**
arms the goal/bonus sprite. On board completion **`stampHomeBayFrogByColumn`** reveals the five homes in sequence: driven by the
reveal countdown `0x8297` (set to 255 by `loc_05d3`, decremented each frame), each selector threshold
stamps the 2x2 frog-in-home graphic (tiles `0xFC`-`0xFF`) into the next bay; the final `A==0x10` selector
delegates to **`fillAllHomeSlotsAndAwardLife`**, which resets all five bays to the empty home tile `0x10`
and awards the extra life. Grounding inverted the code-only reading — `0xFC`-`0xFF` is the frog graphic,
`0x10` the empty bay. All `[seen]`/`[seen,poked]`.

## The frog — move resolution and render — `[seen]`

**`resolveFrogMoveAgainstLanes`** is the upper half of the horizontal-move dispatcher
(**`dispatchFrogMoveAgainstLanes`**, the lower half, dispatches here): the frog X selects one of sixteen arms through the `0x130b` pointer table; ten arms scan a lane's
object list for an object inside the frog's move band and set the block/hit flag `0x8004`, while a clear
lane with the frog not-yet-across tail-calls the frog-kill routine `0x12d0`. **`renderFrogAndArmObjects`**
draws the frog figure into the tilemap (three 4-tile column groups, the banner column, four box corners,
the home-marker string via `blitFourTileGroupColumn`), raises the three object-ready flags
(`0x8007`/`0x8009`/`0x800b`), then tail-chains `seedObjectAnimationState`. **`renderFrogAnimArm1`** and
**`renderFrogAnimArm6`** are two arms of the `0x0faf` frog-animation dispatcher: each loads its sprite
triple, points HL at the pattern table, arms the IX/IY plot cursors at a lane list, stashes the sprite
code at `0x81b1`, and enters the shared render loop `0x0ff1` (arm 1 first runs the guarded pre-blit
`blitFrogAnimColumnOnTrigger`). `[seen]`.

## The sprite-object engine — `[seen,poked]`

An IX/IY sprite-object engine drives the moving hazards through two dispatchers. Dispatcher-B
(**`updateSpriteObject`**) is a spawn-and-run pipeline: **`spawnSpriteObject`** (gated on level count `0x83b7>=3` and an
idle record) makes four **`nextSpawnRandomByte`** draws to density-gate the spawn, pick one of five
variants, and fill the record's tile/attribute/position/direction, then arms it; **`steerSpriteObjectTowardTarget`**
counts down the move timer and drifts the object one step toward its per-object target (despawning —
clearing the 16-byte record and the shared block `0x8058` — on arrival unless the hold flag `0x8004` is
set); **`writeSpriteObjectSlotX`**, **`writeSpriteObjectSlotAttr`** stage the on-screen X and the
state-indexed attribute/code into the IY sprite slot; **`flagSpriteObjectFrogHitAhead`** is the hit test —
on the frog's row, a direction-adjusted position within 16px ahead of the frog X raises `0x8004` and marks
the object hit-consumed (state 2). Dispatcher-A's **`placeSpriteObjectSlotAndRetire`** runs the arm helper
(one-shot + arm sound), writes the slot X/attribute/fold-biased position, and on the fold with the retire
flag clears the record and slot. The batch-2 arms **`animateSpriteObjectFrame`**, **`loc_29f9`** (a motion
arm whose earlier toward-the-frog name was reverted — `0x8014` grounded as a free-running
counter, not the frog X, so the object drifts toward that counter), **`flagSpriteObjectFrogHit`** and the
fly's **`driveFlyPatrol`** remain as described in `names.js`. All
`[seen]`/`[seen,poked]` (a game poked to reach the spawn).

## The two-pair figure (rideable) — `[seen,poked]`

A rideable "two-pair" figure at VRAM `0xa846` has its own small state machine. **`armTwoPairFigureFrame`**
is a one-shot: when the busy latch `0x814f` is clear it raises the step gate `0x8150`, seeds the two
frame cells `0x8146`/`0x8147` from `(0x819b & 0x0f)*8`, and sets the busy latch. **`loc_27ea`** is the
per-frame driver, dispatching on the count `0x83b7` to two dedicated arms at the extremes (kept `loc_` —
the two blind derivers split on whether it is turtle-dive-specific or a generic figure clock, and MAME
did not settle which). **`mountOrKillFrogOnTwoPairFigure`** (gated on `0x8150` bit0 and phase `0x83b7>=2`)
box-tests the frog against the figure: an inner overlap tail-kills the frog (`0x12d0`), an outer overlap
mounts it — stamps the 2×2 mount-tile quad (104..107) at `0xa846` and sets the ride flag `0x8004`.
**`clearLatchedCollision`** is the guarded reset: when the collision latch `0x8135` is set it zeroes the
sub-flag `0x8134` and clears the collision cells `0x8040`–`0x8043`. `[seen,poked]`.

## Board setup and player lifecycle — `[seen]`

At board start **`loadActivePlayerLaneParams`** LDIRs the active player's 33-byte lane-parameter block
into `0x8270`; **`seedObjectAnimationState`** fills the object seed tables; **`initDisplayFieldOnce`**
(guarded by `0x842d`) lays out the score/bonus display field once (blits a strip, fills a tile-12 column,
seeds the countdown pair `0x83dc`/`0x83de`). In a two-player game the turn transition swaps banks:
**`swapInActivePlayerPages`** banks the live object/work pages out to a save area and restores this
player's pages, raising swap-done `0x803f`; **`clearPlayerOneHomeBayGates`** zeros player 1's slot byte
`0x825c` and its five occupancy gates `0x825e`–`0x8262` on the cold board re-init. **`raiseActivePlayerStartFlag`**
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
leaving HL advanced. **`packScoreRankPair`** ranks the P2 and high scores through `insertHighScoreEntry`
and packs the two rank codes into display field `0x83fb`, which **`placeScoreRankMarkers`** then reads,
writing a value-to-position marker (tile 4) into work-RAM page `0x80` — not a rendered numeral (grounding
overturned the "draw digit pair" reading). **`dequeueSoundCommand`** pops the sound-command queue at
`0x8300` and issues the front byte through `issueSoundCommand` (latches `0xD000`, pulses `0xD002` bit 3).
The tile builders: **`blitPlayerSelectPrompt`** draws the player-select prompt — "ONE PLAYER ONLY" on one
credit, else "ONE OR TWO PLAYERS" (grounding overturned the earlier credit/1UP-header reading),
**`blitEndStripAndSetHold`** blits a terminal
strip and raises the hold flag `0x8004` to halt the score-display driver, **`blitGameOverLine`** clears a
tile-group column and blits the fixed 9-tile line, and **`renderMode2IntroScreen`** fills the 28×32
playfield and blits the mode-2 title strips. `handOffToOtherPlayer` toggles players. `[seen]`/`[seen,poked]`.

## Not yet named / open

- **`loc_27ea`** — `[seen,poked]` the two-pair-figure per-frame driver above; kept `loc_` (blind derivers
  split turtle-dive vs generic figure clock, MAME did not settle it).
- **`loc_0c4a`** — `[seen]` a work-RAM store (writes `E` to page `0x80` at `0x80(D-C)`); grounding
  overturned the "intro digit tile" reading. Kept `loc_` (grounded role, no converged name). Called by
  `placeScoreRankMarkers`.
- **`loc_23eb`** — `[seen]` the home-bay slot cursor above; kept `loc_` (both blind proposers misread it).
- **`computeVramColumnIndex`** (`0x1198`) — a pure-register leaf returning only `C`; `[code]`, no
  runtime-observable effect to ground.
- Held back (deliberate handling, not bulk lifts): `0x0b0a`/`0x07d9` (spine-`m.call`ed),
  `0x0f3e` (pops its caller's return — a caller-skip).
- Still translated-only: the frog's hop input, and the road/river vehicle and log **movement**.
