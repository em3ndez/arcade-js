# Time Pilot — mechanisms

The inside-out map: what the ROM actually does, as far as the decompiled layer can currently show.
Its outside-in counterpart is [gameplay.md](gameplay.md), assembled from public sources before
anyone read the ROM; where the two disagree this file says so rather than quietly siding with one.

**This file is rewritten from scratch each understanding pass, never edited.** A map that lags the
code is the tell that a pass was left half-done. Everything below is re-derived from the layer as it
stands; nothing is carried forward on faith.

**Confidence.** `[seen]` means observed under MAME. `[code]` means understood from the routines that
touch it, consistent across them, but not observed. **Every routine reading below is `[code]`** —
the decompile batches measured against our own JS machine, and `names-registry.md` is explicit that
a count from our own harness is `[code]`. Three proposals claimed `[seen]` on that evidence and were
corrected during the confirmer pass. A few RAM cells do carry `[seen]`, earned separately: the pixel
gate drives real MAME and reads them out of its state dump (§5).

---

## 1. The two-level sequencer

The game's top-level control is a **two-level state machine**, and the levels live in adjacent
cells that are easy to mistake for one another.

- **`SEQUENCE_PHASE` (0xA9AB)** — the outer phase. The vblank service masks it to its low two bits
  and dispatches a jump table on the result.
- **`SEQUENCE_SUBSTEP` (0xA9AC)** — the inner index within a phase. Its readers consume it with
  *different masks* — low nibble, low three bits, and unmasked all occur — which is what per-phase
  table sizes look like.

Every phase-entry site writes the pair in one idiom: **set the outer to a small constant, zero the
inner**. `advanceSequenceSubStep` steps the inner one; the routine at 0x0F11 is the same idiom with
an increment in place of the store, advancing the outer and restarting the inner.

### 1.1 The phase byte is booby-trapped

Six routines load `SEQUENCE_PHASE`, fold a block of ROM into it, and store it back with a trailing
constant chosen so the fold **nets to zero on a genuine image**. It is not a second use of the cell —
it is anti-tamper. A patched ROM silently corrupts the phase and derails the state machine instead of
failing cleanly.

The other half of the trap: **six of the seven callers of 0x0F11 are `call nz` / `jp nz` immediately
after a checksum test**, so they are dead code on a genuine image. Only one caller is a real state
test. Anyone counting callers to judge a routine's importance here will be badly misled. `[code]`

---

## 2. The command ring

Deferred work is posted to a **64-cell ring at 0xAC00**, two bytes per entry.

| cell | role |
|---|---|
| 0xAC00.. | the ring, 64 cells; **a cell is free while its high bit is set** |
| 0xA9B2 | write cursor, masked to 0x3F, always even |
| 0xA9B3 | read cursor |

`postCommand` appends a (command, argument) pair and **drops the pair** when the cell the cursor
names is still occupied. The drain reads the pair, writes 0xFF back into both cells to release them,
and dispatches `command & 0x0f` through a sixteen-entry table.

The polarity is fixed by two routines outside the poster: init fills the ring with 0xFF (every cell
free), and the drain restores 0xFF on consumption.

**This is not the sound ring.** Exactly one routine in the whole translated layer writes the audio
latch, and it is not part of this machinery. `[code]`

---

## 3. Scoring, and a conflict with the manual

Command 4 reaches a handler that indexes a table of three-byte BCD values by the argument and adds
it to the score. Arguments 1..8 map to **100..800**.

The poster keeps a two-cell chain:

| cell | role |
|---|---|
| 0xA99D | chain window, reloaded to 30 on every post, ticked down once per frame elsewhere |
| 0xA99E | chain step, advanced only by the poster |

An isolated kill posts argument 1. A kill while the window is still running posts the next argument,
so consecutive hits inside about half a second escalate — and **wrap back to 1 after the eighth**
rather than capping.

> **⚠ Conflict with [gameplay.md](gameplay.md).** The Centuri operator's manual chart gives a flat
> 100 for common enemy craft. The manual's figure is right for an isolated kill; the ROM adds a ramp
> the manual does not mention. **Unresolved by code alone** — the cheap experiment is to shoot two
> planes in quick succession under MAME and read the score. Until then this is a code reading, not a
> statement about the game as played. `[code]`

---

## 4. Objects

### 4.1 Two parallel tables

Every object owns a **record** (16-byte stride, base in `ix`) and a **sprite entry** (2-byte stride,
base in `iy`). `advanceToNextSlot` steps both cursors together — but note it advances a *slot*, not
necessarily an object: three consecutive slots can hold one three-tile sprite.

**Record fields** (offsets from `ix`), as far as the layer shows:

| off | meaning |
|---|---|
| +0 | state code: 0 free, 254 held, 255 live |
| +1 | aim heading |
| +2 | current heading |
| +3, +5 | sub-pixel remainders of the two coordinates |
| +0x0A..0x0D | the velocity pair |
| +0x0E | release / cooldown delay |

**Sprite entry fields** (offsets from `iy`): `+0` and `+49` are the two coordinate whole-parts, `+1`
the tile code, `+48` the control byte. The two halves are 48 bytes apart because they are shadows of
two different sprite banks.

### 4.2 The sprite shadow and the display

The shadow at 0xAA10 (bank 0) and 0xAA40 (bank 1) is copied into sprite RAM every frame, landing at
an offset rather than the same index. The
vertical byte is **complemented on the way out** (`add 0x0e; cpl`), and the renderer then computes
`sy = 241 - value`. The two transforms cancel: **the shadow byte is the raster row.**

That is why zeroing the vertical band parks every sprite at row 0 — above the first drawn line
(visible rows are 16..239), not below the last. A routine not yet in the committed layer does exactly this, and touches no
occupancy byte, so nothing is retired. `[code]`

### 4.3 Steering and the world scroll — the camera

This is the mechanism the layer grounds most completely, and it spans four routines.

1. A heading is a **full-circle byte**: 256 steps, so a quarter turn is 64.
2. The steering routine turns an object's heading one step toward its aim heading, the short way
   round, leaving it alone inside a four-wide arrival window. The step size comes from a five-byte
   table (`01 01 02 02 05`) indexed by a mode cell — five entries, and the game has five eras, so
   later eras plausibly turn faster. One writer steps it as a **mod-5 counter**, which over a
   five-entry table is what an era index would look like; another forces it to a fixed value around
   a single call. The era reading is supported but not settled.
3. A routine not yet in the committed layer looks the heading up in a 256-entry signed word table and returns **two
   components a quarter turn apart**. The components track a near-constant amplitude across the
   heading range, so they read as perpendicular parts of one vector — though not exactly constant,
   as a handful of anomalous ROM words widen the spread. Four tables exist with different
   amplitudes, selected by the same mode cell.
4. A routine negates that pair into **0xA808 / 0xA80A**, and `driftWithWorldScroll` adds those cells
   to every world-static object's coordinates.

**Negated player velocity applied to everything else is the camera.** The ship is pinned and the
world streams past it — which is what [gameplay.md](gameplay.md) §4 records from the public sources:
*"The background moves in the opposite direction to the player's plane."* Code and public record
agree here, independently. `[code]`

### 4.4 Retiring, and why there are two of them

An object leaves play when a coordinate reaches a **retire line**. There are two lines, one per axis,
each three values wide so a fast mover lands on it rather than stepping over.

The lines are the **antipode of the player's own position**. Per-life setup pins the player's sprite
entry at (0x84, 0x78) and the per-frame player update never rewrites those two bytes; the lines sit
at 0x04 and 0xF8, each exactly +0x80 in a coordinate that wraps at 256. So an object retires at the
furthest point it can reach before coming back. This is a **wrap seam, not a viewport edge** — one
line is off-screen, the other is not.

Two retire helpers exist as separate routines — plus a third site that inlines the same three
stores — and no file calls both, so the caller sets are **statically disjoint**: two object families,
each with its own helper.

- **`retireSlot`** zeroes the occupancy byte and both coordinate whole-parts.
- **`retireSlotAndSubPixel`** zeroes those three *and* the two sub-pixel remainders.

Whether the difference is observable depends on the spawn path: some do reinitialise the remainders
immediately after marking a slot live, others have not been shown to. Where they do not, whatever a
retire left behind becomes the next occupant's starting accumulator phase — a sub-frame shift in
when it first steps a whole pixel. Our port reproduces the behaviour either way.

> **Open question.** Did the authors intend the two families to differ here, or are these two habits?
> Code cannot settle it; it needs MAME.

---

## 5. Input and credit

| cell | role |
|---|---|
| 0xA9AE | mirror of the IN0 port, rewritten unconditionally every frame — it shows what the panel asserts, never what the machine decided |
| 0xA981 | set when the machine **accepts** a coin (a debounced rising edge), held briefly |
| 0xAD30 | set while play is active; an explicit flag, stored all-ones and cleared with an exclusive-or |

The distinction between the first row and the other two is load-bearing for any harness: the mirror
proves a button was down, and nothing more. The pixel gate asserts all three, because a tape that
never reaches the machine leaves both emulators in attract, every frame matching, and a run that
played nothing reporting a pass.

---

## 6. Text and captions

Text is drawn one character cell at a time through a cursor in `DE`. One cell is 32 addresses **back**
down the tilemap, and because the cabinet is ROT90 that is one cell **right** on the display — so
`advanceCharCursor` (subtract 32) is reading order, and its mirror (add 32) steps back. At least one
leading-zero suppressor calls the mirror so a following advance nets to zero. Whether every
suppressor follows that policy is NOT established — there is evidence of a second with the opposite
behaviour, writing a glyph and letting its caller advance.

A separate routine stamps the four fixed pieces of the **`© KONAMI` caption** into the display-list
shadow. Hiding those sprites was measured to change no pixels on the paths reached so far. The
*reason* is not settled: a tilemap line covering the same area is one candidate, a per-frame
colour-attribute flip raising tile priority over sprites is another. The measurement stands; the
explanation does not. `[code]`

---

## 7. What is not established

- **Which physical axis is which.** Under ROT90 the labels invert, and the path from the shadow pair
  into the two sprite banks has not been traced end to end. Names in the layer deliberately say
  neither.
- **The mode cell (0xAD04).** It selects both the turn rate and the velocity table amplitude, and
  one of its writers steps it mod 5 over a five-entry table — which is what an era index would do.
  Not settled, but the evidence points that way rather than against it.
- **The scoring ramp** versus the manual's flat 100 (§3).
- **Whether the sub-pixel difference between the two retire helpers is intentional** (§4.4).
- **Which sequence the phase byte indexes** — attract, round intro, or both. Its callers span at
  least the boot self-test and attract.

## 8. What this pass did NOT do, deliberately

**No grounding was run, and no reachability sweep.** Both are required of an understanding pass, and
both were skipped here as a lead ruling rather than an oversight — so it is on the record:

- **Grounding (R2).** This pass identified four experiments and ran none. Naming an experiment is
  not performing one, and a pass that only names them is hollow by the rule's own definition. The
  four are listed in §7; the scoring ramp (§3) is the one that most needs MAME, because it is the
  only place the code and the public record currently disagree.
- **Reachability sweep (R18).** `tools/reach_sweep.lua` exists and no Time Pilot output does. Until
  one is produced, no statement anywhere about what this game "never reaches" rests on a sweep —
  including the unreachable-routine claims in the layer, which rest on driven tapes instead.

**Why deferred.** These ten routines are leaf helpers reached from many callers; the questions
grounding would settle are about the subsystems above them, which are not decompiled yet. Running
the sweep now would measure a layer that is about to change shape. **Pass 2 must do both, and must
not inherit this exemption** — the reason expires as soon as the callers land.

## 9. Known defects in the frozen layer

Recorded because they mislead anyone reading the lift, not because they are correctness hazards:

- `loc_49fa` declares a range that stops short of where its body runs on to, and a second routine is
  a byte-exact **interior slice** of a third — the same tail is transcribed three times. Dispatch is
  by address and every entry resolves to a body starting at that address, so nothing misbehaves.
- Overlapping declared ranges are widespread across the layer rather than isolated to this one, and
  `stepcheck` is structurally blind to duplication: it only asks whether a target is an instruction
  start. Re-derive the extent by parsing the range headers; do not trust a figure written here.
