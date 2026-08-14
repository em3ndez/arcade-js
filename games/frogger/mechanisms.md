# Frogger — how the machine actually works

A code-grounded model of Konami's Frogger (`frogger`, 1981), built from the translated ROM, the
routines the idiomatic layer has rewritten, and the real machine under MAME. Its companion is
`gameplay.md`, which describes the same game from the outside, blind to the code. This document
answers what the code can settle and is honest about what it cannot.

This is the **first** map, written after the first decompile batch and grounded against MAME. That
batch lifted the machine's **status/display and game-state plumbing** — the score/lives row, the time
indicator, the home-row display, the extra-life award, the sound trigger, the two-player handoff, and
the frog-object lifecycle — but **not yet** the road/river gameplay (traffic, logs, turtles, or the
frog's own hop handling). So the map is deep on the HUD and the turn/player structure and largely
silent on the play objects; those arrive in later batches.

**Batch 2** has since lifted 27 further pure-leaf routines (idiomatic modules + equivalence gates, each
`[code]` self-verified against the frozen oracle on crafted or captured entries). They keep their
`loc_<addr>` names and are **not yet named or grounded** — understanding-pass-2 will name them by blind
convergence and then ground each against MAME, and this map will be rewritten to cover them at that
point. Until then this document describes only the batch-1 machinery below; the batch-2 routines exist
in the code but are deliberately not yet written into this narrative (a `[code]` role stated before
grounding is exactly the confident-but-wrong claim the tags guard against). (Three routines were held back from
batch 2: two spine-invoked game-start routines, `0x0b0a` and `0x07d9`, which need the go-live spine's
`m.call` dissolved deliberately; and `0x0f3e`, which pops its caller's return for a two-level
caller-skip — a stack manipulation that cannot be idiomatized as a plain return while its callers are
still translated. Each needs deliberate handling, not a bulk leaf lift.)

**Confidence tags, not decoration:**
- **`[seen]`** — observed on the real ROM under MAME (a captured frame, a VRAM/RAM read, a control
  poke, or a write tap). Where an observation was reached by poking a cell rather than natural play,
  this says **`[seen,poked]`** — the reading is real but the trigger was forced.
- **`[code]`** — derived from a translated routine's behaviour; the mechanics are exact, the role is
  inference, and MAME did not (or could not) exercise it this pass.
- **`[guess]`** — plausible, unverified.

A role is `[seen]` only if its evidence terminates in MAME, never in our own engine. This pass grounded
all twenty batch-1 leaves; two overturned a `[code]` reading (below), two settled a refusal, and one
had a `[code]` branch MAME could not reach.

## The frame and the engine — `[code]`; rendering fidelity `[seen]`

Frogger runs on Galaxian/Scramble-derived Konami hardware: a tilemap background with hardware sprites,
an 8255 PPI for inputs/DIPs and the sound-command latch, and a second Z80 + AY-3-8910 for sound. The
idiomatic layer runs its rewritten routines in place of the frozen translated oracle, born live. The
frame boundary is a vblank **yield**, not a cycle count; each in-play pass hands control back at the
pace tail (`0x0368`). Rendered idiomatic frames match a fresh MAME golden to **0px** at the
boot-collapse landmark — `[seen]` that the port is pixel-faithful there.

## The status/display area — `[seen]`

- **`renderLivesRow`** draws up to **fifteen** reserve-frog markers (tile `0x4C`) down the column at
  `0xA87E`, one 32-cell row apart — count = `(0x83B7)`, clamped at 15. `[seen,poked]`: poking
  `0x83B7=4` produced exactly four markers (rows 3–6), value 1 → one, and the bottom-left reserve-frog
  icons grew to match.
- **`renderTimeBar`** draws the small **column-30** time indicator: `(active time byte 0x83E5 P1 /
  0x83E6 P2)` copies of tile `0x4D` up the column at `0xABBE`. `[seen]`: the tile count equalled the
  time byte every frame (2→2, 1→1, 0→empty). **The prominent draining green time bar** (columns 28/29,
  tiles `0x48`–`0x4B`, the one that empties to kill the frog) is a **separate routine not yet lifted** —
  the on-screen time display is multi-part.
- **`renderFilledHomeSlots`** stamps the four home-frog tiles (`0x6C`–`0x6F`) at a filled slot's fixed
  VRAM base. `[seen]`: a played frog reached a home and exactly that slot's 2×2 block appeared, the
  other four bases still blank — the visual record of "fill all five homes."
- The block/column fills lay down the background and status blocks — `[seen]` by write-trace at exact
  geometry: **`fillTilemapBlock28x32`** (base `0xA802`), **`fillTilemapBlock22x32`** (base `0xA808`),
  **`fillTwoByTwoTileBlock`**, **`fillTenCellRun`**, and **`copyRunUpTileColumn`** (destination steps
  up one row per byte, values varying — a copy, not a fill).

## Lives and the extra frog — `[seen,poked]`

**`awardExtraLife`** is reached on **board completion — all five frogs home** (via `loc_06A2`, which
tests `A == 0x10`, → `loc_0670`), **not a score threshold**. It bumps the active player's life count
(`0x83B8`/`0x83B9`), mirrors it to `0x83B7`, and — unless the marker count is already **fifteen** on
screen — stamps another reserve-frog marker; the value `16` (`0x10`) caps the **marker**, while the
count itself runs past it. `gameplay.md`'s "extra frog at a score threshold" is **refuted for this
routine** (whether a separate score-based award exists elsewhere is unobserved).

## The time limit — `[seen]`

Two distinct things this batch can separate. The **col-30 indicator** is `renderTimeBar` (above),
driven by the per-player time byte `0x83E5`/`0x83E6`. **`loc_0292`** — still `loc_`, but its role is
now grounded — is **NOT** that time clock: it is a short one-shot **frog-spawn/ready delay**. `[seen]`
(played): `0x829D` was seeded to `0x20` (32) at frog/game start and decremented once per frame to zero
(~0.5s, never re-seeded), at which point `loc_0066` spawns the frog. The earlier `[guess]` that this
countdown drove the time bar is overturned.

## Two players and the cabinet — `[seen]`

**`raiseTwoPlayerStartFlag`** and **`swapOutActivePlayerPages`** fire during a real two-player game
(the latter right after each handoff to player two). **`handOffToOtherPlayer`** toggles the active
player (`0x83FD` flips 1↔2 in lockstep) and — when the **cocktail** shadow `0x83C2` is set —
sets `0x83CB=1` and writes **flip_x `0xB810=01` + flip_y `0xB80C=01`**, and the captured frame shows
player two's screen rotated **180°** (score row to the bottom, TIME to the top). `[seen]` for the
player toggle by natural play; `[seen,poked]` for the cocktail branch (the Cabinet DIP had to be poked).

## The frog object — `[seen]` (with a `[code]` branch)

**`activateFrogObject`** marks the frog object active — `[seen]` write tap `PC=0808 W 8044=01`, and
`0x8045`/`0x8047` cleared. Its conditional two-player timer-seed (`0x83D2`/`0x83DA ← 0x0040`)
**never fired**, even in a real 2P game, because the routine is only called with `PLAY_FLAG (0x83FE)=0`
— that branch stays `[code]`, unreached, not refuted. **`resetFrogObject`** writes the frog object's
four bytes (`OBJECT_INIT [80,1E,03,E0]` at `0x8044`) and raises a ready flag — `[seen]` at frog spawn,
the visible player frog appearing at the start position.

## Sound — `[seen]`

**`issueSoundCommand`** latches a command byte to `0xD000`, then pulses `0xD002` bit 3 **low (the
falling edge is the sound CPU's `/INT`) then high** — `[seen]` by write tap, firing with many distinct
command bytes during play. Which byte selects which sound is not decoded here.

## Object bookkeeping and scoring — `[seen]`

**`clearObjectBlocksAndMirrorToObjRam`** zeroes a work-RAM object block, mirrors the zeroed head into
OBJRAM, and zeroes a sprite block — `[seen]` executing at setup. **`insertHighScoreEntry`** inserts a
16-bit key into the **five-entry descending high-score table** ending at `0x83F2`: `[seen]` that
`0x83F1`–`0x83FA` holds exactly the attract **SCORE RANKING** (04630/02050/01970/01580/01270, BCD ÷10),
`0x83F2` the top slot — the table identity is dispositive, though a live insert was not observed.
**`nextSpawnRandomByte`** steps a ring XOR-fold over the `0x8400` buffer, returning a byte its callers
(`loc_2A6A`/`loc_2C13`, object arms gated on `(0x83B7) ≥ 3`) consume to place object spawns — `[seen,
poked]` a continuously churning high-entropy source feeding spawn placement: a **PRNG, not a checksum**.

## One routine still `loc_`, role grounded

- **`loc_05d3`** — `[seen,poked]` per-player **board-completion re-arm** (all five frogs home): it
  writes `0x826D`/`0x825A`/`0x83CD=1`, clears `0x825B`/`0x83EA`, sets `0x8297=0xFF`/`0x8298=0x40`, and
  `0x8298` then times the board-complete animation. It **never fires in attract** (the demo-arming
  reading is refuted) and fired in a one-player game (not 2P-specific). The role is grounded, but no
  blind proposer converged on a name for it, so it stays `loc_` and earns a name in the next pass.

## Open questions (what this pass did not settle)

- The routine that draws the **main draining green time bar** (`0x48`–`0x4B`, cols 28/29) — not lifted.
- Whether a **score-based** extra frog exists (this batch's `awardExtraLife` fires on board completion).
- A live **high-score insert**, a **natural board completion**, and `activateFrogObject`'s **2P
  timer-seed** — all unobserved; the high-score/board/cocktail/PRNG triggers here were poke-reached.
- The frog's hop handling, collision, and the road/river objects (traffic, logs, turtles) — not lifted.
- Diving turtles, the lady frog, the fly, the crocodile, the snake — ground in MAME when lifted.
