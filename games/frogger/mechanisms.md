# Frogger — how the machine actually works

A code-grounded model of Konami's Frogger (`frogger`, 1981), built from the translated ROM, the
routines the idiomatic layer has rewritten, and the real machine under MAME. Its companion is
`gameplay.md`, which describes the same game from the outside, blind to the code. This document
answers what the code can settle and is honest about what it cannot.

Two decompile batches are lifted and grounded: batch 1 (the status/display and game-state plumbing)
and batch 2 (the scroll engine, the home-bay animations, and the sprite-object arms). The frog's own
hop handling and the road/river vehicle/log movement are still translated-only, so the map is quiet on
those. This revision was **folded**, not rewritten whole from `gameplay.md` — a full blind rewrite is
owed and this note records that debt.

**Batch 3** has since lifted a further set of routines — the first NON-LEAF batch (routines that call
already-lifted callees). They keep their `loc_<addr>` names and are **not yet named or grounded**;
understanding-pass-3 will name them by blind convergence, ground each against MAME, and rewrite this
map to cover them. Until then they exist in the code but are deliberately absent from this narrative —
a `[code]` role stated before grounding is exactly the confident-but-wrong claim the tags guard against.

**Confidence tags, not decoration:**
- **`[seen]`** — observed on the real ROM under MAME; **`[seen,poked]`** when the trigger was forced by
  a memory poke rather than natural play (the reading is real, the path was forced).
- **`[code]`** — from a translated routine's behaviour; mechanics exact, role inference, MAME did not
  exercise it.
- **`[guess]`** — plausible, unverified.

A role is `[seen]` only if its evidence terminates in MAME, never our own engine. Where grounding
overturned a code-only reading, the map says so.

## The frame and the engine — `[code]`; rendering fidelity `[seen]`

Galaxian/Scramble-derived Konami hardware: a tilemap background with hardware sprites, an 8255 PPI for
inputs/DIPs and the sound-command latch, and a second Z80 + AY-3-8910 for sound. The idiomatic layer
runs its rewritten routines in place of the frozen translated oracle, born live; the frame boundary is
a vblank yield, not a cycle count, re-entering at the pace tail (`0x0368`). Rendered idiomatic frames
match a fresh MAME golden to **0px** at the boot landmark — `[seen]` the port is pixel-faithful there.
At cold boot **`spinWatchdogSettleDelay`** feeds the watchdog by strobing the I/O port at `0x8800`
(non-RAM: writes read back `0xFF`) from a `BC=0xEFFF` settle loop — `[seen,poked]`.

## The scrolling background — `[seen]`

The river/road background scrolls, driven from an NMI scroll handler. **`blitScrollTileGrid`** stamps
tile pairs (`0x34`–`0x37`) down VRAM columns from base `0xA808` at a 32-byte row pitch;
**`stampScrollRevealColumn`** writes the newly-revealed edge column into the `0xA800` VRAM block; and
**`blitScrollBand`** writes the scrolling tile-band rows. All three fire together during the attract
scroll burst — `[seen]` by write-tap. **`blitFourTileGroupColumn`** paints 14-row two-wide columns of
the four-tile group (tiles `72`–`75`) — the **river-log** graphics (`[seen]` in a demo frame).

## The home bays — `[seen]`

The five top bays are the goal, and the code that decorates them is a small animation engine keyed by a
slot cursor. **`loc_23eb`** advances the `loc_8123` slot cursor mod-6, read by the stampers as the
home-slot index 1..5 (grounding **overturned** the earlier "river/lane-scroll phase" reading). Into a
bay whose occupancy flag is clear, the engine stamps one of several creatures at that bay's fixed VRAM
base (`0xA864`/`0xA924`/`0xA9E4`/`0xAAA4`/`0xAB64`): **`stampHomeBayFly`** the fly bonus creature
(tiles `0x2C`/`0x2D`), **`stampHomeBayGatorEmerging`** then **`stampHomeBayGatorFull`** the crocodile
hazard surfacing (tiles `0xD0`–`0xD3`) across two phases. All `[seen,poked]` (forced a game to reach
them). When the frog reaches a bay, **`stampHomeBaySlot`** stamps the resting-frog block and
**`armHomeGoalSprite`** arms the goal/bonus sprite (writes the bay-Y descriptor to `0x8040`, arm timer
`0x8340=160`, the "200" bonus shown) — `[seen]`/`[seen,poked]`. These settle `gameplay.md`'s fly, the
crocodile, and the home-bay scoring; the earlier code-only readings had mislabeled these as scroll markers.

## The sprite objects — `[seen,poked]`

An IX/IY sprite-object engine drives moving objects. **`animateSpriteObjectFrame`** counts the frame
timer at `(IX+8)`, steps the phase `(IX+6)`, and indexes the phase-tile table at `0x2CD5` with the flip
bits into the sprite tile/attr pair. **`steerSpriteObjectTowardFrog`** drifts the object's X `(IX+2)`
toward the frog's X (`0x8014`) and flips its direction bit at the turn. **`flagSpriteObjectFrogHit`**
is the hit test: on frog-row/X overlap it raises the hit flag `0x8004` and the global gate `0x842C`.
The **fly** has its own patrol, **`driveFlyPatrol`**, which runs the tongue timer, flips the sprite
code (codes `0x30`–`0x33`) at the midpoint, and walks an X-offset path table into the fly sprite.
**`animateTwoPairFigure`** and **`blitFrogAnimColumnOnTrigger`**/**`advanceAnimationFrameBuffer`** are
the smaller animation clocks (a gated 2×2 figure blit, and a trigger-driven frog-anim tile-pair blit
whose 11-byte indexed frame advances each in-play frame). All `[seen]`/`[seen,poked]`.

## Board setup — `[seen]`

At board start **`loadActivePlayerLaneParams`** follows the difficulty pointer table at `0x2260` and
LDIRs the active player's 33-byte lane-parameter block into `0x8270`; **`seedObjectAnimationState`**
fills the object seed tables at `0x800D`/`0x8021` with fixed coded values (zero before board start).
**`clearFourByteCounterBlock`** zeroes `0x805C`–`0x805F` and **`clearTwoPlayerFrameCells`** — only in a
real two-player game (`0x83FE==2`) — zeroes five per-frame animation cells at a player switch.
**`tickGatedCountdown`** decrements `0x826A` while its enable flag `0x826C` is set, clearing the flag at
zero. **`setAttractIdleMode`** forces `GAME_MODE (0x83D6)=5` when a credit is present, dropping the
demo out of attract. `[seen]`/`[seen,poked]`.

## Status, scoring, and sound — `[seen]` (batch 1)

`renderLivesRow` draws up to fifteen reserve-frog markers; `renderTimeBar` the small col-30 time
indicator (the main draining green bar is separate, unlifted); `renderFilledHomeSlots` the filled-bay
frogs. `awardExtraLife` awards the extra frog on **board completion** (all five homes), not a score
threshold. The five-entry descending table at `0x83F2` is the **high-score ranking**
(`insertHighScoreEntry`), matching the attract SCORE RANKING. **`writeScoreDigitStepUp`** writes one BCD
score digit and steps the VRAM pointer up a 32-cell row (its callers are the score routines).
`issueSoundCommand` latches a byte to `0xD000` and pulses `0xD002` bit 3 for the sound CPU's `/INT`.
`nextSpawnRandomByte` is the spawn PRNG. `handOffToOtherPlayer` toggles players (cocktail flips the
screen 180°). See the batch-1 detail preserved in the routine roles in `names.js`.

## Not yet named / open

- **`loc_0c4a`** — `[seen]` a work-RAM store (writes `E` to page `0x80` at `0x80(D-C)`); grounding
  overturned the "intro digit tile" reading. Kept `loc_` (grounded role, no converged name).
- **`loc_23eb`** — `[seen]` the home-bay slot cursor above; kept `loc_` (both blind proposers misread it
  as river/scroll, so no name is trusted yet).
- **`computeVramColumnIndex`** (`0x1198`) — a pure-register leaf returning only `C`; `[code]`, its role
  is code-consistent but produced no runtime-observable effect to ground.
- Held back from batch 2 (deliberate handling, not bulk lifts): `0x0b0a`/`0x07d9` (spine-`m.call`ed),
  `0x0f3e` (pops its caller's return — a caller-skip).
- Still translated-only: the frog's hop handling, and the road/river vehicle and log **movement**.
