# Time Pilot — mechanisms

The inside-out map: what the ROM does, as far as the decompiled layer can show. Its outside-in
counterpart is [gameplay.md](gameplay.md), assembled from public sources before anyone read the ROM;
where the two disagree this file says so rather than quietly siding with one.

**Rewritten from scratch each understanding pass, never edited.** A map that lags the code is the
tell that a pass was left half-done.

**Confidence.** `[seen]` means observed under MAME; `[code]` means understood from the routines that
touch it. **Every routine reading below is `[code]`**, though one MECHANISM is now `[seen]` (§3) — the decompile batches measured against our
own JS machine, and a count from our own harness is `[code]`. A few RAM cells carry `[seen]`, earned
separately: the pixel gate drives real MAME and reads them out of its state dump (§5).

---

## 1. The two-level sequencer

- **`SEQUENCE_PHASE` (0xA9AB)** — outer phase; the vblank service masks it to two bits and
  jump-tables on it. `advanceSequencePhase` steps it and restarts the inner.
- **`SEQUENCE_SUBSTEP` (0xA9AC)** — inner index, consumed with *different masks* by different
  readers, which is what per-phase table sizes look like. `advanceSequenceSubStep` steps it alone.

Every phase-entry site writes the pair in one idiom: outer to a constant, inner to zero.

### 1.1 The phase byte is booby-trapped

Several routines fold a block of ROM into `SEQUENCE_PHASE` and store it back with a constant chosen
so the fold **nets to zero on a genuine image**. Anti-tamper: a patched ROM corrupts the phase and
derails the state machine rather than failing cleanly. Most of `advanceSequencePhase`'s callers sit
behind such a fold and are dead on a genuine image, so **counting callers to judge importance
misleads here.** `[code]`

---

## 2. The command ring

| cell | role |
|---|---|
| 0xAC00.. | the ring: 64 bytes, so 32 two-byte entries; **free while the high bit is set** |
| 0xA9B2 | write cursor, masked, always even |
| 0xA9B3 | read cursor |

`postCommand` appends a (command, argument) pair and **drops it** if the cursor's cell is occupied.
The drain releases both cells and dispatches the command's low nibble through a sixteen-entry table.
Polarity is fixed outside the poster: init fills the ring free, the drain restores it. **Not the
sound ring.** `[code]`

---

## 3. Scoring

Command 4 indexes a BCD table by its argument. The table reads **100…900, 1000, 1500, 2000, 3000,
4000, 5000** — recovered from ROM bytes. It is a SUPERSET of `gameplay.md` §9's Centuri chart:
every charted value appears, but 200 through 900 appear nowhere in the chart.

`postChainedHitScore` ramps: an isolated kill posts the first argument, a kill inside the chain
window posts the next, wrapping rather than capping. The reset that restarts it lives **outside**
the poster, in a per-frame routine on the play arm's call list. The code encodes its scoring split
as a **slot range** under a collision master and never names an object class, so "common enemy" is
the manual's word rather than the ROM's, and this poster serves more than one object array.

Bomber, formation and Mother-Ship values are posted as fixed arguments elsewhere. **The parachutist
ladder is a second ramp of a different shape** — a per-pickup counter walks a short table and then
pins at the top value, so it CAPS where this one WRAPS. `gameplay.md` §9 already records that ladder
as capped, so the ROM and the public record agree.

> **SETTLED UNDER MAME, and the manual is incomplete rather than wrong. `[seen]`** The experiment
> was run: a real MAME capture driving coin, start and tapped fire, reading the score cells out of
> its own state dump. Sixteen awards over ninety seconds. Isolated kills pay 100, which is the
> manual's figure. Kills a handful of frames apart pay 200, and one run of three paid 100, 200, 300
> in twenty-one frames. **The ramp exists and it is observable.** The tape that produced it is
> `tools/lua/score_ramp_tape.lua`; re-run it rather than trusting this paragraph.
>
> What is still open is the ramp's *ceiling* — the code wraps after the eighth step, and no capture
> so far has chained that far.

---

## 4. Objects

### 4.1 Two parallel tables

A **record** (16-byte stride, `ix`) and a **sprite entry** (2-byte stride, `iy`).
`advanceToNextSlot` steps both — a *slot*, not necessarily an object, since consecutive slots can
hold one multi-tile sprite that `placeAbuttingTile` builds by seeding the next entry from the
current one.

| record off | meaning |
|---|---|
| +0 | state: 0 free, 254 held, 255 live |
| +1 | aim heading |
| +2 | current heading |
| +3, +5 | sub-pixel remainders |
| +0x0A..0x0D | velocity pair |
| +0x0E | release / cooldown delay |

`releaseHeldObject` ticks that delay and promotes held→live on expiry. Sprite entry: `+0` and `+49`
the coordinate whole-parts, `+1` tile code, `+48` control — the halves 48 apart because they shadow
two banks.

### 4.2 The sprite shadow and the display

The shadow is copied into sprite RAM every frame at an offset, through **two DMA variants** selected
by the screen-flip flag. Composed with the renderer:

- **main variant** — the shadow byte **is** the raster row.
- **mirrored variant** — the raster row is one greater.

Both park a zeroed slot at the **top**, one row apart; neither puts it below the last line.
`hideAllSprites` zeroes the whole vertical band and touches no occupancy byte, so everything hides
and nothing retires. The mirrored variant is rare but real — a zeroed slot's bottom row can land on
the first visible line there. `[code]`

### 4.3 Steering and the world scroll — the camera

1. A heading is a **full-circle byte**: 256 steps, a quarter turn is 64.
2. `steerTowardAimHeading` turns one step the short way round, idle inside a four-wide arrival
   window, at a rate from a five-entry table.
3. `velocityForHeading` returns **two components a quarter turn apart**. Every selectable table
   holds a NEAR-constant magnitude around the circle — not exact; anomalous words widen the spread
   — with one table close to a pixel per frame in 8.8 fixed point. Speed times unit direction.
4. Another routine negates that pair into 0xA808 / 0xA80A, and `driftWithWorldScroll` adds those to
   every world-static object.

**Negated player velocity applied to everything else is the camera.** `gameplay.md` §4 records the
same thing independently: the background moves opposite the plane. `[code]`

### 4.4 The era index

**0xAD04 is the round/era index.** It is stepped as a **mod-5 counter** and reloads per-round
parameters in the same breath; its caller chain runs off the Mother-Ship award, so destroying the
Mother-Ship advances the round. It selects the turn-step table, the velocity amplitude, and several
jump tables. `gameplay.md` §5 and §11 describe five eras in strict order wrapping to the first, with
speed and manoeuvrability rising — written before anyone read the ROM.

The routine that forces it to a fixed value around a single steering call is a **temporary
override**, not the writer. **A grep for a direct store misses the real one, which writes through a
pointer** — so anyone re-deriving this must search for the pointer form or they will conclude the
cell has a single writer and strike the era reading as unearned. `[code]`

### 4.5 Retiring

An object leaves play when a coordinate reaches a **retire line** — one per axis, three values wide
so a fast mover lands on it. The lines are the **antipode of the player's own position**, which
per-life setup pins and the per-frame update never rewrites. A wrap seam, not a viewport edge.

Two helpers plus a third site that inlines the same stores; no file calls more than one, so the
caller sets are statically disjoint — per-family helpers, not versions of one.

- **`retireSlot`** zeroes occupancy and both coordinate whole-parts.
- **`retireSlotAndSubPixel`** zeroes those and the sub-pixel remainders.

Observability depends on the spawn path: some reinitialise those cells right after marking a slot
live, most do not. Where they do not, what a retire left behind becomes the next occupant's starting
accumulator phase.

> **Open.** Whether the families were meant to differ, or whether this is two habits.

---

## 5. Input and credit

| cell | role |
|---|---|
| 0xA9AE | IN0 mirror, rewritten every frame — shows what the panel asserts, never what the machine decided `[seen]` |
| 0xA981 | set when the machine **accepts** a coin, debounced rising edge `[seen]` |
| 0xAD30 | set while play is active `[seen]` |

The first row's distinction is load-bearing: the mirror proves a button was down and nothing more.
The pixel gate asserts all three, because a tape that never reaches the machine leaves both
emulators in attract with every frame matching.

---

## 6. Text and captions

A cursor in `DE` walks character cells; one cell is 32 addresses back down the tilemap, and under
ROT90 that is one cell **right** on the display — so `advanceCharCursor` is reading order and
`retreatCharCursor` its exact inverse. At least one leading-zero suppressor calls the retreat so a
following advance nets to zero; whether every suppressor does is not established. `fillCellRun` lays
a fixed-length uniform run, used with a blanking glyph in the character plane and a computed colour
in the colour plane.

`stampCopyrightStrip` places the caption glyphs into the display-list shadow. **They are never
visible on any path reached**: hiding those sprites changes zero pixels, while blanking the tilemap
cells over them changes hundreds. Those cells are category 1 and painted opaquely over sprites in a
later pass — the sprites are *occluded*, not duplicated. `[code]`

---

## 7. Reachability

A PC-gated sweep over the unnamed routines, driven through play, finds a majority executing and a
substantial minority not. Re-derive with `tools/reach_sweep.lua`; the hot tail is the backlog worth
taking next.

**The instrument lies on this game unless gated.** A plain read tap counts *any* read of an entry
byte, and this ROM folds blocks of itself for anti-tamper (§1.1) — so an ungated sweep reported
**every** unnamed routine as reached, including routines independently proven dark. The tool now
requires the program counter to be at the address. Its header warned about the mirror failure
(encrypted opcode regions making everything look unreached); the prescribed sanity check, tapping a
known-executing address, is blind to this direction.

---

## 8. What is not established

- **Which physical axis is which** — under ROT90 the labels invert and the shadow-to-bank path is
  not traced end to end.
- **The scoring ramp** against the manual (§3). Needs MAME.
- **Whether the retire helpers' sub-pixel difference is intentional** (§4.5).
- **Which sequence the phase byte indexes.**
- **What `fillCellRun`'s runs are** — nothing dispatches it under any tape, so its purpose is
  unknowable while its mechanism is certain.

## 9. Known defects in the frozen layer

- A routine declares a range stopping short of where its body runs on, and another is a byte-exact
  interior slice of a third — the same tail transcribed three times. Dispatch is by address and
  every entry resolves to a body starting there, so nothing misbehaves.
- Overlapping declared ranges are widespread rather than isolated, and `stepcheck` is blind to
  duplication: it only asks whether a target is an instruction start. Re-derive the extent by
  parsing the range headers; do not trust a figure written here.
