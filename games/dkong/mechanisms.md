# Donkey Kong (Nintendo, 1981) — How It Works Inside

> **What this document is.** The *inside-out* companion to `gameplay.md`. Where that
> file describes how Donkey Kong is *played* from public sources (day-zero, no ROM),
> this one describes how the machine *works*, built only from the decompiled code in
> this repo — the `idiomatic/` routines, the named work-RAM map in `idiomatic/ram.js`
> (moved 2026-07-31 off the retired `optimized/` layer; the idiomatic routines import it
> directly), and the hardware/render layer in `boards/dkong/`. `gameplay.md` is the frame;
> every claim below is reconciled against it and grounded in a routine or a RAM cell.
>
> **Confidence tags.** Each non-obvious claim carries one:
> - `[seen]` — validated by *playing* the game: pixel-diffed vs MAME 0.288, or a
>   reproduced control-poke. The strongest evidence we have.
> - `[code]` — read directly out of a decompiled routine or a re-derived RAM name.
> - `[guess]` — inference not yet pinned to code (the routine is still oracle-only, or
>   the exact ROM data table has not been lifted). Flagged so it is never mistaken for fact.
>
> **Honest floor.** 194 of the game's 423 routines are decompiled into readable
> `idiomatic/` JavaScript; the other ~230 still exist only as the frozen `translated/`
> oracle (+ `optimized/`). The biggest not-yet-lifted block is the **actor/enemy AI**
> (barrels, fireballs, elevators, springs, cement pans). So the *boot → attract →
> board-setup → Mario-movement → board-advance → level-loop* spine is described from
> code; the *moment-to-moment behaviour of the hazards* is described more thinly, and
> those entries are tagged accordingly. See §Decompile coverage.

---

## 1. The game model

Jumpman/Mario climbs a construction site to rescue Pauline from Donkey Kong across
**four single-screen boards**, then the whole thing loops harder. That outer shape
(from `gameplay.md`) is confirmed by the code, which represents it as two nested
counters plus a small ROM order-table.

- **Objective.** Reach Pauline (girder/conveyor/elevator boards) or pull every rivet
  (rivet board). Each clear advances a **board pointer**; wrapping the pointer bumps a
  **level counter** and the difficulty with it. `[seen]` `[code]`
- **The cast, as the engine sees it.** *Mario* is a privileged actor with his own
  8-byte-plus motion block at `0x6200–0x6220` and his own hardware sprite record
  (`MARIO_SPRITE_RECORD 0x694C`). Everything else — barrels, fireballs, the elevators,
  springs, cement pans, Pauline's dropped prizes, Kong himself, even the floating score
  glyph — is a **4-byte object/sprite record** in the shared sprite shadow buffer
  (`SPRITE_BUFFER 0x6900`, 96 records) fed to the screen by DMA. `[code]`
- **Win, per board.** A single byte, `GAME_SUBSTATE (0x600A)`, is forced to **0x16**
  ("board-cleared / advance"). Two conditions reach that write, both in
  `enterBoardAdvanceAndUnwind`: a **rivet board with `RIVETS_LEFT (0x6290) == 0`**, or a
  **girder/rescue board where Mario has climbed to the rescue row near Pauline**. `[code]`
- **Lose.** A life is spent (`LIVES (0x6228)` `dec`) on a fatal fall, a hazard hit, or
  the **bonus timer reaching 0**. The bonus-expired path is its own little state machine
  (`BONUS_EXPIRED_STEP 0x6386`). Game over when `LIVES` hits 0. `[code]`
- **Scoring.** Three little-endian packed-BCD bytes per player (`P1_SCORE 0x60B2`,
  `P2_SCORE 0x60B5`), plus `HIGH_SCORE 0x60B8`. Points are never added inline — a
  **task message** `[opcode 0, award-index]` is posted to a ring buffer and the main
  loop credits it later (see §9). `[code]`
- **Progression + loop.** A 16-bit ROM pointer `BOARD_SEQ_PTR (0x622A)` walks a
  board-order table (init `0x3A65`); each entry is copied to `BOARD (0x6227) ∈ {1,2,3,4}`.
  A `0x7F` terminator reloads the pointer to `0x3A73` (the level-5+ group) and increments
  `LEVEL (0x6229)`, so the game loops forever with rising difficulty. **Validated by
  playing 25m→50m→75m→100m→wrap→level++, frame-for-frame vs MAME.** `[seen]` `[code]`

### The four boards

`BOARD (0x6227)` selects one of four setup routines and thereafter gates per-board
behaviour (often via the `rst 0x30` "board bit" gate, `boardBitGate`). `[code]`

| `BOARD` | Name | Setup routine | Hazard cast (mostly still oracle-only) |
|--------:|------|---------------|----------------------------------------|
| 1 | **25m** girders & barrels | `seed25mBoardObjects` | rolling barrels, fireballs, oil drum, 2 hammers |
| 2 | **50m** conveyors / "pie factory" | `seed50mBoardObjects` | cement pans on belts, fireballs, retracting ladders, prizes + hammers |
| 3 | **75m** elevators & springs | `seed75mBoardObjects` | moving elevator platforms, bouncing springs, flames, prizes |
| 4 | **100m** rivets (finale) | `seed100mBoardObjects` | flames, 8 rivets to pull; pull the last → Kong falls |

The canonical arcade order **25→50→75→100** from `gameplay.md` is exactly what the
sequence table produces for level 1 `[seen]`. The bonus-item prizes (parasol / hat /
purse) are driven by `runBonusItemValueDisplay` and appear on the non-25m boards `[code]`,
matching `gameplay.md`.

---

## 2. The machine spine: NMI, main loop, game-state dispatch

One vblank NMI per frame drives everything. `[code]`

- **`serviceVblankNmi` (ROM 0x0066)** — one frame of interrupt service: reads controls,
  stirs the PRNG, blits sprites via DMA, ticks the sound driver, then falls into `perFrame`.
- **`perFrame` (ROM 0x00B5)** — decrements the `FRAME (0x601A)` counter (everything
  periodic keys off it) and dispatches on `GAME_STATE (0x6005)`: **0** power-on,
  **1** attract, **2** credited (start select), **3** in-game. The dispatch itself still
  routes through the generic oracle `dispatchGameState` (the one address-registry the
  decompiler keeps for genuine computed control flow).
- **PRNG.** `stirRandomSeed` (ROM 0x0057) does `RANDOM (0x6018) += FRAME + SPIN_COUNT`
  every vblank. `SPIN_COUNT (0x6019)` is bumped ~140×/frame by the main loop; its jitter
  with per-frame workload is the entropy source. For JS↔MAME determinism the fleet pins
  this to a fixed value (see the entropy-pinning note in `docs/06`). `[code]`
- **In-game sub-dispatch.** `dispatchInGameSubstate` (ROM 0x06FE) reads
  `GAME_SUBSTATE (0x600A)` and vectors through a **29-entry ROM jump table at 0x0702**:
  7 = opening Kong-climb cutscene, 8 = "how high" interlude, 0x0A = board setup,
  0x0C/0x0D = gameplay, 0x0E = P1 death, **0x16 = board-cleared/advance**, 0x15 = the
  bonus-item display. Six slots are null and the selector is **not** range-checked — a bad
  sub-state vectors off the table (surfaced as a loud throw, never a silent reset). `[code]`

The two `rst`-vector guards `gameActiveGuard` (proceed only in a credited game) and
`marioActiveGuard` (proceed only while Mario is alive) are the caller-skip primitives
that gate most per-frame work. `[code]`

---

## 3. Boot, attract, coins, and starting a game

- **`powerOnInit` (ROM 0x01C3)** — `GAME_STATE == 0`, one-time init.
- **`decodeDipSwitches` (ROM ~0x020E)** — unpacks DSW0 into the settings block:
  `DIP_LIVES (0x6020)` = 3–6 lives, `DIP_BONUS_LIFE (0x6021)` = extra-life threshold
  (default **7000**, matching `gameplay.md`), coin ratios, and `DIP_UPRIGHT (0x6026)`
  (upright vs cocktail → flip-screen). `[code]`
- **Attract.** `runAttractState` (ROM 0x073C) services `GAME_STATE == 1`;
  `composeAttractTitleScreen` builds the title/score screen. Attract plays **25m only**,
  which is why so many gameplay routines can only be gated by crafted pokes, not captured
  attract frames (noted throughout the equivalence tests). `[code]`
- **Coins.** `serviceCoinInput` (ROM 0x017B) debounces the coin line via a `COIN_EDGE
  (0x6003)` latch (so holding the coin line never repeat-credits), tallies
  `COINS_PARTIAL (0x6002)` against the DIP ratio, and awards BCD `CREDITS (0x6001)`.
  Proven by a coin test: each pulse counted exactly once. `[seen]`
- **Start.** `enterCreditScreen` → `readStartButtonSelector` → `commitGameStart` spend the
  credit(s) (`spendCredit`), seed the player context, and move `GAME_STATE` to 3.
  `restorePlayer1Context` / `restorePlayer2Context` `ldir` an 8-byte saved context
  (`P1_CONTEXT 0x6040` / `P2_CONTEXT 0x6048`) into the live block `0x6228` and re-derive
  `BOARD` from the sequence pointer. Two-player alternation is armed off
  `TWO_PLAYER_GAME (0x600F)`. `[code]`

---

## 4. Building a board

`initBoardState` (ROM 0x0F56) is the heart of board setup, and it is fully decompiled. `[code]`

1. **Clear** the player/motion block `0x6200–0x6226` and the big object+sprite span
   `0x6280–0x6AFF`, then overlay the 0x40-byte board-object header template from ROM
   `0x3D9C`.
2. **Compute the bonus** (see §6): `BONUS_START/BONUS/BONUS_EVENT_MARK` = `min(LEVEL*10 +
   0x28, 0x50)` in byte arithmetic; the tick period = `max(0xDC − 2*bonus, 0x28)`.
3. On every board **except** the 100m rivet board, seed three fixed decorative sprite
   records at `0x6A00`.
4. **Dispatch on `BOARD`** to `seed25m/50m/75m/100mBoardObjects`.

The per-board setup then lays down the playfield. The tilemap is stamped by a family of
drawing primitives — `drawGirderSpan` (fills a segment body with the girder tile 0xC0),
`drawLadder` (a kind-2 ladder run down a column), `drawSegmentEndCap`, `fillTileColumn`,
`fillTileBlock`, `fillTileRowPair`, `fillDescendingColumn`, plus board-specific stampers
(`stamp50mBoardTiles`, `stamp75mBoardTiles`, `stampRivetBoardBands/Tiles`,
`stampFixedTilePair`, `stampTwoTileBands`). `loc_0da7`/`loc_0dd3` walk the board-layout
**segment table** and draw each segment (endpoints → run deltas → body fill). `[code]`

Objects for the board are scattered into records by `loadBoardObjectRecords`,
`loadSpriteObjectBlock`, `seedObjectBlockSprites`, `seedSpriteObjectPair`,
`replicateGroupStrided`, and Mario himself is spawned by `seedMarioActorRecord` at a
board-dependent start. `[code]`

---

## 5. Mario: walk, climb, jump, fall

This subsystem is well decompiled and **pixel-validated in play** (the 25m completion
tape climbs a ladder and rescues Pauline frame-for-frame vs MAME). `[seen]` `[code]`

**State lives in RAM, not registers.** `MARIO_X (0x6203)` / `MARIO_Y (0x6205)` with
16.8 fixed-point fractions, `MARIO_AIRBORNE (0x6216)` (0 grounded / 1 airborne),
`MARIO_ON_LADDER (0x6215)`, the sprite/pose byte `MARIO_SPRITE_CODE (0x6207)` (low bits =
state code, **bit 7 = facing**), and a cluster of airborne registers. `[code]`

- **Walk.** `beginWalkStep` / `continueWalkStep` shift Mario 1px per frame while a
  sub-step timer `MARIO_MOVE_STEP_TIMER (0x620F)` runs (`tickMoveStepTimer` decrements
  it), advancing `MARIO_WALK_ANIM (0x6202)` at each reload; `triggerWalkSound` fires the
  3-frame footstep. `loc_1d76` is the "timer still running" branch. On 25m the girder
  slopes, so `snapYToGirder` nudges Y one pixel along the slope as Mario walks. `[code]`
  **Trap confirmed by play:** to climb you must first *walk* horizontally onto the ladder
  X; posing on the ladder and pressing Up never latches. `[seen]`
- **Climb.** With `MARIO_ON_LADDER` set, `centerMarioAndCommitClimbStep` snaps Mario to
  the ladder centre, `setClimbSpriteFrame` cycles the climb pose,
  `markOnLadderAndCommitSprite` flags the ladder state, and `endClimbAtLadderLimit` stops
  the climb when `(Y+8)` hits either ladder-extent limit (`MARIO_CLIMB_LIMIT_A/B
  0x621B/0x621C`). `[code]`
- **Jump.** `initMarioJump` flags airborne and picks a horizontal launch velocity from
  the held direction (**+0x0080** Right / **0xFF80** Left / **0** straight up);
  `launchMarioJump` (ROM 0x1B8A) commits the arc: fixed upward impulse **VY = 0x0148**,
  jump pose code 0x0E, snapshots the take-off height `MARIO_AIR_START_Y (0x620E)`, fires
  the jump sound. Hammer in hand ⇒ the jump button is skipped entirely (you cannot jump
  while carrying it), matching `gameplay.md`. `[code]`
- **Ballistic motion + gravity.** `stepBallisticMotion` (ROM 0x239C) advances an airborne
  actor one frame. Gravity is *derived*, not stored: `ΔY16 = −(V + 8 − 16n)` where `V` is
  the initial VY and `n = MARIO_AIR_FRAMES (0x6214)` — verified 0 mismatches over 142
  airborne frames. `[code]`
- **Fatal-fall test.** At airborne-frame 0x14 (near apex) the handler arms a landing
  check; on landing, if Mario is more than 0x0F px below his take-off Y, `MARIO_FATAL_FALL
  (0x6220)` is set and the landing kills him (`MARIO_ACTIVE = fatal XOR 1`). Falling off a
  ledge sets `MARIO_START_FALL (0x6221)` with zero initial velocity. `[code]`
- **Landing freeze.** Landing loads a 4-frame `MARIO_FREEZE_TIMER (0x621E)` during which
  Mario is unresponsive; on expiry it applies any pending hammer pickup and clears the
  walk animation (`tickPostLandingFreeze`). `[code]`
- **Sprite commit.** `writeMarioSpriteRecord` refreshes Mario's 4-byte hardware record
  (X, code, attr, Y) each frame from his state. `[code]`

**The hammer** (`gameplay.md` §5) is code-confirmed: `MARIO_HAMMER_ACTIVE (0x6217)` swaps
in the hammer sprite + BGM and a duration counter `HAMMER_TIMER (0x6394)`; the hammer ends
when the counter's high byte reaches 2 (~512 frames). A touched-but-not-held hammer is
latched in `MARIO_HAMMER_PENDING (0x6218)` and transferred on the post-landing freeze. The
swing animation is driven by bit 3 of the low timer byte. `[code]`

---

## 6. The bonus timer, scoring, prizes — and the level-22 kill screen

**Bonus timer.** `initBoardState` sets the starting bonus (§4). It is held in
`BONUS (0x62B1)`, units of 100 (on-screen = `BONUS*100`). It ticks down two different
ways: on **boards 2/3/4** a metronomic decrementer (period `BONUS_PERIOD 0x62B3`,
measured L2→100, L3→80, L4→60 frames), and on **board 1** the barrel-release routine
doubles as the tick. Reaching 0 sets `BONUS_EXPIRED_STEP (0x6386)`, whose small state
machine (`dispatchBonusExpiredStep`, `bonusExpiredIdle`, `startBonusExpiredDelay`,
`advanceBonusExpiredStepWhenDelayExpires`) runs the timeout death. `[code]`

**Per-level starting bonus — confirmed and refined.** `gameplay.md` reports L1=5000,
L2=6000, L3=7000, L4+=8000 from public sources; the code computes exactly that:

| `LEVEL` | `10*LEVEL+40` | after byte-wrap + `min(·,0x50)` | on-screen |
|--------:|--------------:|--------------------------------:|----------:|
| 1  | 0x032 | 0x32 (50) | 5000 |
| 2  | 0x03C | 0x3C (60) | 6000 |
| 3  | 0x046 | 0x46 (70) | 7000 |
| 4…21 | 0x050…0x0FA | clamped 0x50 (80) | 8000 |
| **22** | **0x104** | **wraps to 0x04 (4)** | **400** |
| 23 | 0x10E | 0x0E (14) | 1400 |

**The level-22 kill screen falls straight out of this code.** `[code]` The starting-bonus
computation is 8-bit: at `LEVEL == 22`, `10*22+40 = 260 = 0x104`, which byte-wraps to
`0x04`. Since `4` is below the `0x50` clamp, the board opens with a **400-point timer**
that expires in seconds no matter how well you play. `gameplay.md` §4.5/§9 flagged the
exact overflow arithmetic as a "community reconstruction"; here it is exact, in
`initBoardState`, refining that from *widely-reported* to *confirmed*.

**Extra life.** `sub_0350` grants one score-threshold extra life per player (latch
`BONUS_LIFE_AWARDED 0x622D`), comparing the score against `DIP_BONUS_LIFE` (default 7000)
— matching `gameplay.md`'s "bonus life at 7,000". Code-cited but never observed firing (no
captured run crossed the threshold). `[code]`

**Awarding points.** `awardScorePopup` (ROM 0x1E28) is the "you scored" effect: it posts
the add-to-score task, stages a floating number glyph as a sprite over Mario, and (on 25m
and 75m only, via the board gate) pings the award sound. It is fed by `loc_3e70`, which
picks one of three tiers (award index 1/3/5 ↔ glyph 0x7B/0x7D/0x7F) — the multi-obstacle
100/300/500 jump tiers from `gameplay.md`. `[code]` The concrete points-per-index table
lives in ROM at `0x3529` and is **not yet decompiled**, so the exact tier→points mapping
is `[guess]` on the code side (though `[seen]` in play).

**Prizes (parasol / hat / purse).** `runBonusItemValueDisplay` (ROM 0x1486, sub-state
0x15) drives the collectible bonus item on the non-25m boards: it advances the item's grid
position, animates its sprite, and paints a **decrementing value (starts at 30)** in the
on-screen digits — collect it sooner for more. `positionBonusItemSprite` places it.
This matches `gameplay.md`'s prizes-on-50m/75m/100m and the "walk over it to collect"
model; the exact 300/500/800-by-level scaling is in ROM data, so `[guess]` on the code side.

---

## 7. Board completion, advance, and the level loop

- **Completion.** `enterBoardAdvanceAndUnwind` (ROM 0x1E85) writes `GAME_SUBSTATE = 0x16`
  and unwinds out of the movement cascade (no more movement that frame). Reached from a
  zero rivet count (`loc_1e80`) or Mario climbing to the rescue row (`loc_1e6d`). `[code]`
- **Rivets.** `collectEdgeRivet` (ROM 0x1A33) is the 100m pickup: board-gated to `BOARD==4`,
  it *arms* when Mario stands on a screen-edge column (`MARIO_X == 0x4B` or `0xB3`) and,
  when he steps off, clears the correct `RIVET_PRESENT[slot] (0x6292+n)`, decrements
  `RIVETS_LEFT (0x6290)`, and blanks the rivet's tiles. Last rivet → board-complete. `[code]`
- **Advance.** The `0x16` sub-state runs a render sequence (`loc_1644` and its timed
  steps `loc_1654…loc_18c6`, plus `buildHowHighScreen`) and ends in **`advanceToNextBoard`**
  (ROM 0x178E): step `BOARD_SEQ_PTR` forward, read the next board, and on the `0x7F`
  terminator reload to `0x3A73` — **the wrap that makes the game loop**. `LEVEL` is
  incremented at the terminator, `HOW_HIGH_INDEX (0x622E)` is reset, and the "HOW HIGH CAN
  YOU GET?" interlude plays for the new board. **Validated end-to-end in play including
  100m→wrap→level++→25m.** `[seen]` `[code]`
- **Difficulty ramp.** `DIFFICULTY (0x6380) = min(LEVEL + (DIFFICULTY_CLOCK>>3), 5)` rises
  with both level and time-on-board; it feeds barrel/enemy behaviour, so the same board
  gets meaner the longer you dawdle and each loop is harder — the qualitative "faster,
  sometimes diagonal" of `gameplay.md`, as a clamped 1–5 knob. `[code]`

---

## 8. The opening Kong-climb cutscene

Sub-state 7 (reached only when `PLAY_INTRO 0x622C` is set — post-death boards skip it):
Kong climbs the girders carrying Pauline. Driven by `INTRO_STEP (0x6385)` through an
8-entry table: `dispatchIntroCutsceneStep`, `setupIntroCutsceneStep`,
`animateIntroClimbStep`, `runIntroClimbStep`, `scrollClimbGraphicStep` (scrolls the climb
graphic up a row), `runIntroRoarStep` (the chest-pound roar audio at step 7). `[code]`
This is the "intro", **not** the rescue — a correction the RAM map is explicit about
(`GAME_SUBSTATE` doc note): an earlier pass misread a 7 at a board transition as a "rescue
flag"; it is the *next* board's intro. Board progression is real regardless. `[seen]`

---

## 9. Cross-cutting engines: tasks, sound, DMA, colour-cycle

- **Task ring.** A 32-slot ring at `TASK_RING (0x60C0)` with head/tail pointers
  (`TASK_HEAD/TASK_TAIL 0x60B1/0x60B0`). `enqueueTask` posts `[opcode, arg]`;
  `enqueueTaskBatch` posts a fixed batch. Opcode 0 = add-to-score (proven by injecting
  `(0,5)` → score `000500`). This is how scoring, credit-display refreshes, and deferred
  effects are decoupled from the frame that triggers them. `[seen]` `[code]`
- **Sound.** `soundDriverTick` pushes queued state to the audio hardware each NMI; the
  8 per-bit triggers `SND_TRIGGER[8] (0x6080)` are 3-frame asserts; `SND_BGM (0x6089)` /
  `SND_PRIORITY (0x608A)` select the looping tune vs a priority override. `silenceSound`
  zeroes it all. Per-bit sound *meanings* are the audio layer's, not re-derived here. `[code]`
- **Sprite DMA.** `blitSpritesViaDma` (ROM 0x0141) programs the i8257 to copy the 384-byte
  sprite shadow buffer `0x6900 → 0x7000` every vblank. `[code]`
- **Colour-cycle.** `dispatchColorCyclePaint` and `runRivetColorCycleBlink` drive the
  attract/rivet colour animation via a sweep counter and blink pair
  (`blinkSpritePair*`, `paintColorColumn*`), gated by `COLOUR_CYCLE_ACTIVE (0x6391)`. `[code]`

---

## 10. The hardware / render layer (`boards/dkong/`)

This layer is hand-transcribed from MAME's `dkong.cpp` (it has no equivalence gate — it is
the one ungated surface, validated by pixel-diff), so it is `[code]` from the driver, not
from the ROM. `[code]`

- **`memory.js`** — the Z80 address space: ROM `0x0000–0x3FFF`, work RAM
  `0x6000–0x6BFF` (note the `0x6BFF` bound, and `0x6C00–0x6FFF` is **not** RAM), sprite RAM
  `0x7000–0x73FF`, video/tilemap RAM `0x7400–0x77FF`, i8257 DMA `0x7800–0x780F`, and the
  I/O strip `0x7C00–0x7D87`. Three modelling rules it exists to enforce: read≠write at the
  same address (0x7C00 reads IN0 / writes the sound latch), reads aren't pure (reading
  0x7D00 kicks the watchdog), and unmapped access throws loudly. `[code]`
- **`video.js`** — deterministic ROM decode: 8×8×2 planar tiles (256 of them), 16×16 2bpp
  sprites (128), and the colour PROMs. Plane order is a real decision (getting it backwards
  swaps colour indices), transcribed from the driver, not guessed. `[code]`
- **`io.js`** — inputs, DIP reads, the ls259 control latch (flipscreen / sprite bank / NMI
  mask / DRQ), sound latch/trigger writes. `[code]`
- **`hardware.json`** — the tool-facing declaration (screen 256×224, CPU 3.072 MHz,
  50688 cycles/frame, the RAM/sprite/video state regions, reset register values, boot
  landmark cycles). Single source of truth for the shared Python tools. `[code]`

---

## 11. Decompile coverage — what is and isn't lifted

**Measured (this checkout):**

| Metric | Count |
|--------|------:|
| Routines lifted to readable `idiomatic/` `.js` | **194** |
| — English-named | 141 |
| — still `loc_<addr>` (address-named, awaiting a name) | 53 |
| Address-named routines in the frozen `translated/` oracle (denominator) | **423** |
| Named work-RAM cells in `optimized/ram.js` (`export const`) | 95 |
| `translated/` `.js` files total (423 routines + 11 scaffolding wrappers) | 434 |
| `optimized/` `.js` files | 236 |
| **Idiomatic coverage** | **194 / 423 ≈ 46%** |

The other ~230 routines run **live and pixel-correct** — they are the frozen `translated/`
oracle (with `optimized/` collapsed versions), just not yet rewritten into readable JS.
By ROM region, the largest not-yet-lifted blocks are:

- **`0x1F00–0x2E00` — the actor/enemy/object AI (biggest gap).** This is the moment-to-
  moment behaviour of the hazards: barrel spawn & roll (Kong's throws, barrels tumbling
  girders and going "wild" down ladders), fireball / firefox AI, elevator and spring
  motion (75m), cement-pan / conveyor behaviour (50m), and the generic object engine —
  the object-list collision search (`entry_2913`), object movement with edge-clamping
  (`move_2b02` does `X += velocity` then clamps via `sub_241F`), slope-contact flags
  (`entry_2acd`), and the per-object update (`obj_2e12`). The Mario-side *collision consume*
  is lifted (`scanObjectsAtMarioX`, `confirmObjectHit`), but the hazards' *own* logic is
  not. So anything in this doc about how a barrel decides to roll wild, how a fireball
  chases, or how a spring bounces is `[guess]` / `[seen]`, not `[code]`. `[guess]`
- **`0x0300–0x0600`** — remaining BCD/score/high-score compare and math helpers
  (e.g. the high-score update at `0x0540`, the extra-life grant `sub_0350`). `[code]` partial.
- **`0x3100–0x3400`** — remaining engine/scheduler/sprite utility helpers.

**Bottom line:** the *skeleton* of the game — power-on → attract → coin/start →
board-setup → Mario movement → board-complete → advance → level-loop, plus the timer,
scoring plumbing, prizes, rivets, cutscene, and the hardware/render layer — is decompiled
and, for the load-bearing path, **validated by play against MAME**. The *flesh* — the
enemy behaviours that make each board distinct in motion — is still oracle-only and is
described here at lower confidence, tagged accordingly.

---

## 12. Routine table (194 idiomatic routines, grouped)

One line each, from the routine's own doc comment. `loc_<addr>` entries are lifted but not
yet English-named.

### Machine spine — NMI, frame, dispatch, guards
| Routine | What it does |
|---------|--------------|
| `serviceVblankNmi` | the vblank NMI handler: one frame of interrupt service |
| `perFrame` | per-frame service + game-state dispatch tail of the vblank NMI |
| `dispatchInGameSubstate` | vector the in-game state to its current sub-state handler (ROM 0x0702 table) |
| `dispatchCreditedSubstate` | vector the credited game (state 2) to its sub-state handler |
| `dispatchInlineJumpTable` | the `rst 0x28` inline-jump-table trampoline |
| `gameActiveGuard` | caller-skip guard: proceed only while a credited game is in play |
| `marioActiveGuard` | caller-skip guard: proceed only while Mario is alive |
| `boardBitGate` | the `rst 0x30` vector: a per-board skip gate |
| `readControls` | select the active joystick port, edge-debounce into the cooked input word |
| `stirRandomSeed` | mix the pseudo-random seed once per vblank |
| `tickSubstateTimer` | tick the sub-state countdown, report expiry |
| `tickSubstatePrescaler` | tick the low half of the sub-state timer |
| `tickDispatcherCountdown` | tick a state hold timer; reset the dispatcher on expiry |

### Boot, attract, coins, start, player context
| Routine | What it does |
|---------|--------------|
| `powerOnInit` | game state 0: the one-time power-on initialization |
| `decodeDipSwitches` | unpack DSW0 into the settings block; load ROM defaults |
| `runAttractState` | service the attract game-state once per NMI |
| `composeAttractTitleScreen` | build the attract title/score screen |
| `enterAttractMode` | reset the machine into attract mode |
| `enterCreditScreen` | accept the inserted credit; set up credit / start-select |
| `serviceCoinInput` | debounce the coin line, tally pulses, award BCD credits |
| `readStartButtonSelector` | read which allowed start button is pressed |
| `commitGameStart` | commit a credited game start: spend credit(s), seed context |
| `spendCredit` | deduct one credit; post the credit-display refresh task |
| `drawCreditDisplay` | paint the "CREDIT nn" line |
| `restorePlayer1Context` | restore player 1's saved context, re-derive the board |
| `restorePlayer2Context` | reinstate player 2's saved game context |
| `selectPlayer2AndComposeScreen` | make player 2 current, then compose the screen |
| `selectPlayerScreenOrAttract` | sub-state-0x14 handler: hold game-over, else attract |
| `armTwoPlayerBoardSetup` | the 2-player arm of the board-setup sub-state step |
| `configureFlipScreenAndComposeScreen` | orient the display for the player who is up |
| `configureFlipScreenAndSelectSubstate` | first in-game NMI's start-up step |
| `composeScreenAndAdvanceSubstate` | post an intro step's draw tasks and "1UP" |
| `draw1UpLabel` / `draw2UpLabel` | stamp the fixed "1UP"/"2UP" score-label cells |
| `loc_0a1b` | one step of the two-player board-setup chain |
| `loc_13aa` | small reset: mirror the cabinet DIP into flip-screen |
| `loc_13bb` | reset the live player/display context to player 1 |
| `loc_138f` | timed sub-state transition, branched on P2's saved context |
| `loc_1344` | idx-15 in-game handler: decrement the current player's timer |
| `loc_13ca` | format a packed-BCD score into display digits |

### Sub-state timer plumbing & screen transitions
| Routine | What it does |
|---------|--------------|
| `advanceSubstateAndArmTimer` | step to the next sub-state and hold it for N frames |
| `advanceSubstateWhenGrounded` | hold this sub-state until Mario has landed, then step |
| `clearSubstateWhenTimerExpires` | park on a timed sub-state, then clear it |
| `clearScreenAndAdvanceSubstate` | wipe the screen, then step to the next sub-state |
| `clearScreenAndSelectSubstate` | wipe the display, then jump the in-game sub-state |
| `clearScreenAndSelectIntro` | clear the screen; route board-start to the intro |
| `loc_12de` | on timer expiry, tear down the finished sub-state's sprites |
| `loc_13a1` | a timer-gated 0x0702 sub-state handler (table idx 0x17) |

### Opening Kong-climb cutscene
| Routine | What it does |
|---------|--------------|
| `dispatchIntroCutsceneStep` | vector the opening cutscene to its current step |
| `setupIntroCutsceneStep` | step 0: draw the cutscene |
| `animateIntroClimbStep` | step 2: animate Kong's climb |
| `runIntroClimbStep` | stage one climb phase of the cutscene |
| `runIntroRoarStep` | the roar/finish step (chest-pound audio) |
| `scrollClimbGraphicStep` | advance the climb graphic up one row |
| `loc_0b06` | one step of the cutscene's display-list build |
| `loc_0b68` | step 6: scroll the sprite-object block |
| `loc_07cb` | a timed animation sub-state step |

### Board setup: layout, tiles, object seeding
| Routine | What it does |
|---------|--------------|
| `initBoardState` | reset per-board RAM, compute bonus/timer, dispatch to board setup |
| `seed25mBoardObjects` | build the 25m board's initial object records |
| `seed50mBoardObjects` | build the 50m board's object + sprite records |
| `seed75mBoardObjects` | build the 75m board's object records |
| `seed100mBoardObjects` | build the 100m (rivet) board's object records |
| `seedMarioActorRecord` | spawn Mario's actor record at a board-dependent start |
| `loadBoardObjectRecords` | scatter this board's ROM object-init records |
| `loadSpriteObjectBlock` | copy the 40-byte sprite-object block from the caller |
| `seedObjectBlockSprites` | seed a 10-record block's shared sprite field |
| `seedSpriteObjectPair` | place a pair of sprite objects at two given cells |
| `reloadObjectBlockAndAdvanceStep` | reload the board's sprite-object block |
| `replicateGroupStrided` | copy one 4-byte group into B strided destinations |
| `loc_0d5f` | board-setup continuation: common per-board init + scatter |
| `loc_0cc6` | the shared tail every board-setup dispatch arm converges on |
| `loc_0da7` | walk the board-layout segment table and draw each segment |
| `loc_0dd3` | convert a segment endpoint, compute run deltas |
| `loc_3fa0` | board-setup prelude: stamp the 50m-only tiles |
| `loc_11fa` | scatter a 6-byte source record into an IX record + array |
| `drawGirderSpan` | fill a segment body with the girder tile 0xC0 |
| `drawLadder` | stamp a kind-2 ladder run down the tilemap |
| `drawSegmentEndCap` | stamp a segment's endpoint tiles, advance the cursor |
| `drawCappedTileColumn` | stamp a capped vertical tile run |
| `fillTileBlock` | stamp a fixed 5×14 block of tile 0x10 |
| `fillTileColumn` | fill a tilemap column with a kind-selected tile |
| `fillTileRowPair` | stamp a fixed two-row motif |
| `fillDescendingColumn` | write a 3-cell descending run |
| `fillColumnAndContinueWalk` | fill a tilemap column from the cursor, then continue |
| `stamp50mBoardTiles` | stamp four 50m-only tilemap cells |
| `stamp75mBoardTiles` | stamp two fixed 75m (elevator) cells |
| `stampRivetBoardBands` | stamp the two-band motif into two rows |
| `stampRivetBoardTiles` | stamp a 2-tile motif into eight cells |
| `stampFixedTilePair` | paint a fixed two-tile decoration |
| `stampTwoTileBands` | stamp two 4-cell tile bands |

### Mario movement: walk, climb, jump, fall
| Routine | What it does |
|---------|--------------|
| `beginWalkStep` | start a new walk-animation step for Mario |
| `continueWalkStep` | carry an in-progress walk step one frame further |
| `tickMoveStepTimer` | decrement the player's walk/climb sub-step timer |
| `triggerWalkSound` | request Mario's footstep sound for 3 frames |
| `loc_1d76` | the "sub-step timer still running" walk/climb branch |
| `snapYToGirder` | nudge a coordinate one pixel along the 25m girder slope |
| `markOnLadderAndCommitSprite` | flag Mario on a ladder, refresh his sprite |
| `centerMarioAndCommitClimbStep` | the ladder-centering phase of a climb step |
| `endClimbAtLadderLimit` | finish a ladder climb that reached a ladder end |
| `setClimbSpriteFrame` | stamp Mario's climb-animation sprite for one step |
| `initMarioJump` | begin a jump: flag airborne, pick horizontal velocity |
| `launchMarioJump` | commit the ballistic jump; snapshot take-off Y; jump sound |
| `stepBallisticMotion` | advance an airborne actor one frame along its arc |
| `tickPostLandingFreeze` | count down the post-landing freeze; unfreeze on expiry |
| `writeMarioSpriteRecord` | refresh Mario's 4-byte hardware sprite record |
| `loc_241f` | classify Mario's X into a two-flag position gate |
| `loc_1d95` | commit the 0x6225 collection flag; off-25m pickup sound |

### Objects, collision, effect sprites (partial)
| Routine | What it does |
|---------|--------------|
| `scanObjectsAtMarioX` | broad-phase X test of the per-frame object-collision scan |
| `confirmObjectHit` | confirm an X-match is Y-aligned + eligible; register the hit |
| `animateSpriteObjectBlock` | advance one animation frame of the ten-record block |
| `stepSpriteAnimationSequence` | advance one step of the 0x6388-driven sprite anim |
| `addToSpriteObjectColumn` | the `rst 0x38` vector: add a delta into one record field |
| `cullSpriteObjectsAtTop` | clear the X of any sprite-object risen to the top |
| `gatherSpriteRecords` | build a run of hardware sprite records |
| `allSlotsClear` | is a strided table of ten object slots fully cleared? |
| `reverseStepDirection` | flip the sign of a signed direction-step byte |
| `signStepHalfRate` | collapse a direction byte to a ±1 step, every other frame |
| `loc_26a6` | step a mirrored pair of animation counters, opposite ways |
| `loc_2602` | per-frame driver for one of three timed sprite objects |
| `loc_16bb` | clear object #1's reversal flag, route the moving group |
| `loc_16d0` | arm object #1's countdown, slide the group |
| `loc_16d5` | drive object #1, slide its 10-sprite group along X |
| `loc_16e1` | on reaching its rail, reinitialize the moving group |
| `loc_1708` | board/intro spawn init: silence sound, seed a sprite |
| `loc_127f` | vector a short animation sequence to its step handler |
| `loc_128b` | phase-0 (seed) arm of the 0x639D animation sequence |
| `loc_12ac` | phase-1 arm of the 0x639D animation sequence |
| `loc_1dbd` | router for the effect-sprite state machine (0x6340) |
| `loc_1dc9` | state-1 handler: arm the state-2 countdown, advance |
| `loc_1df5` | pick one of three effect-sprite setters from RANDOM bits |
| `loc_1e00` | load an effect-sprite's (code, task) params and hand off |
| `loc_1e08` | stage an effect's constants, then run the setter |
| `loc_1e10` | effect-sprite setter: load (B, DE), hand off to the feeder |
| `loc_1e15` | post the queued task, fetch the effect sprite's X/Y |
| `loc_1e36` | stamp a 4-byte sprite record, cue a board-gated sound |
| `loc_1e49` | the idle arm of the 0x6340 state router |

### Board-advance & "how high" interlude
| Routine | What it does |
|---------|--------------|
| `enterBoardAdvanceAndUnwind` | commit "board complete" (GAME_SUBSTATE 0x16), unwind |
| `advanceToNextBoard` | step the board-order pointer; enter "HOW HIGH"; the loop wrap |
| `advanceBoardStepWhenSpritesCleared` | one arm of the board-advance sequence |
| `buildHowHighScreen` | build the "HOW HIGH CAN YOU GET?" interlude screen |
| `loc_1644` | vector the board-advance render sequence to its step |
| `loc_1654` | step 0: run the intro/board spawn |
| `loc_1662` | bump an anim counter; on 25m only, extra work |
| `loc_1670` | one timer-gated step of the board-advance sequence |
| `loc_168a` | one timer-gated step: re-init the render |
| `loc_16a3` | sequence step 0: spawn init, stamp the ten-record figure |
| `loc_1732` | one animation-gated step of the board-advance sequence |
| `loc_17b6` | idx 0 of the 0x6388 render sequence: draw the how-high screen |
| `loc_186f` | one timer-gated step of the board-advance sequence |
| `loc_1880` | one step of the how-high interlude render sequence |
| `loc_18c6` | per-frame pacer for the board-advance / how-high transition |

### Rivets (100m) & colour-cycle blink
| Routine | What it does |
|---------|--------------|
| `collectEdgeRivet` | the 100m edge-rivet pickup handler |
| `armEdgeRivetPickup` | raise the edge-item pickup latch |
| `runRivetColorCycleBlink` | the 100m rivet-board branch of the colour-cycle |
| `dispatchColorCyclePaint` | per-frame colour-cycle repaint router |
| `blinkSpritePairByX` | pick the blink phase by the player's X |
| `blinkSpritePairOn` / `blinkSpritePairOff` | the blink driver's ON / OFF arms |
| `storeBlinkSpriteCode` | commit sprite record #1's tile-code byte |
| `paintColorColumnAndBlinkOff` | rivet-board colour arm: preset fill code, blink off |
| `paintColorColumnAndHoldBlink` | the colour-cycle "leave-as-is" arm |
| `paintColorColumnWithLowCode` | the colour-cycle LOW-CODE arm |

### Scoring, bonus timer, prizes, death
| Routine | What it does |
|---------|--------------|
| `awardScorePopup` | award points, stage the floating score glyph over Mario |
| `loc_3e70` | pick one of three effect/score tiers from the low bits of A |
| `runBonusItemValueDisplay` | drive the on-board bonus item (prize): position, sprite, value |
| `positionBonusItemSprite` | place the bonus-item sprite at its current cell |
| `dispatchBonusExpiredStep` | run the bonus-expired (timeout death) state machine |
| `bonusExpiredIdle` | the idle arm of the bonus-expired machine |
| `startBonusExpiredDelay` | arm the DELAY phase of the bonus-expired sequence |
| `advanceBonusExpiredStepWhenDelayExpires` | the DELAY step of the bonus-expired sequence |
| `losePlayer1Life` | spend one of P1's lives, snapshot context, route on |
| `drawLivesAndLevel` | redraw the reserve-lives indicator and level number |

### Task ring & sound
| Routine | What it does |
|---------|--------------|
| `enqueueTask` | post a 2-byte [opcode, argument] message onto the task ring |
| `enqueueTaskBatch` | post a fixed batch of messages onto the task ring |
| `soundDriverTick` | push queued sound state to the audio hardware, once per NMI |
| `silenceSound` | zero every sound output and its work-RAM shadow |

### Rendering & DMA
| Routine | What it does |
|---------|--------------|
| `blitSpritesViaDma` | program the i8257, blit the sprite shadow buffer to sprite RAM |
| `clearPlayfieldAndSprites` | blank the tilemap playfield, zero the sprites |
| `clearTilemapAndSprites` | blank the ENTIRE tilemap and zero the sprite shadow |
| `clearSpriteColumns` | zero the X byte of four fixed groups of sprite records |
| `tileAddrForPixel` | map a screen pixel (y,x) to its tilemap cell address |
| `renderBcdColumn` | draw a packed 3-byte BCD value as six digits up a column |
| `expandBcdDigits` | unpack packed BCD/hex bytes into two digit cells each |
| `drawStringVertical` | draw a doubly-indirected string down a tilemap column |
| `writeDigitPairWithCarry` | stamp two digit tiles side by side, carrying a value |
| `storeDigitAndAdvance` | write one BCD/hex digit to the destination cell, step cursor |
| `stampTwoDigitField` | stamp a two-digit number's tile pair into its field |
| `loc_30db` | zero Mario's sprite X, then a stride-4 run of six |

### Low-level memory / bit / math primitives (`rst` vectors & helpers)
| Routine | What it does |
|---------|--------------|
| `addStrided` | add a constant to each of B bytes at HL, stride DE |
| `xorMaskStridedPair` | XOR a mask into two bytes at HL, stride DE |
| `copyByteDisplaced` | copy one byte from an indexed cell to a displaced cell |
| `copyBytePairsStrided` | scatter B source byte-pairs into strided records |
| `clearStridedBytes` | zero B bytes at stride 4, walking the low address byte |
| `loc_3009` | bit-field lookup over a packed 4×2-bit table |

---

*Sources: `games/dkong/idiomatic/*.js` (194 routines), `games/dkong/optimized/ram.js`
(95 named cells), `boards/dkong/{memory,video,io}.js` + `hardware.json`, framed against
`games/dkong/gameplay.md`. Counts measured this checkout. Not-yet-lifted routines
characterized from the frozen `translated/` oracle by ROM region.*
