# Tempest — mechanisms

A code-grounded model of how Tempest actually runs, built from the translated 6502 lift and the
idiomatic rewrite, and confirmed against the real ROM under MAME. It grows with the port: this first
edition covers the subsystems reached by the first idiomatic decompile batch (leaf routines), framed
inside the overall machine structure. Everything outside those leaves is still described only where the
surrounding lift makes it certain.

**Confidence tags.** Every claim carries one. `[seen]` — a role-defining observation on the real ROM
under MAME (a watched write, a value change, confirmed reachability). `[code]` — derived from the
faithful lift's behaviour, mechanically exact but the *role* is inference. `[guess]` — plausible,
unverified. A `[code]` routine is real code whose game-purpose is simply not yet pinned; where the
purpose is genuinely open the identifier stays `loc_<addr>` rather than assert a confident-wrong name.

## The shape of the machine

Tempest is a colour vector game: the CPU builds a display list in AVG vector RAM (`0x2000-0x2FFF`)
each frame and the Analog Vector Generator draws it. The 6502 runs a free-running main loop with the
vblank interrupt as the per-frame heartbeat; a game-state index in the low RAM drives a computed-jump
dispatch that selects the handler for the current mode (attract, coin-in, play, transitions). Most of
the work below sits *under* that dispatcher: the per-object animation engine, the vector-list builders,
and the state-reset chains that run when a mode or level begins. This altitude is machine plumbing —
the vector and object machinery beneath the visible cast — so many roles are legible from the code yet
carry no direct line in the outside-in game description.

## The object motion-script engine

Objects are animated by a small byte-coded **motion script**, not by open-coded per-object logic. A
driver walks a per-object script whose bytes are fetched through the ROM tables at `0xa0f7`/`0xa0f8`,
maintaining an instruction pointer in `0x010b`, a branch/condition flag in `0x010c`, and a
loop-continuation flag in `0x010a`; the object being written is selected by the slot base `0x0298`.
Each script byte is an opcode dispatched through a computed (RTS-trick) table, and the opcode handlers
are leaves:

- **`loc_9bd0`** advances the instruction pointer and copies the next script byte straight into the
  object's slot — an immediate store. `[seen]`: the pointer bump and the slot writes into `0x029b-0x029e`
  are observed under MAME.
- **`loc_9bdd`** advances the pointer, then treats the next script byte as a zero-page address and copies
  *that* live variable into the slot — an indirect store, the variable-operand counterpart of `loc_9bd0`.
  `[seen]`.
- **`loc_9bee`** is a conditional skip: when the branch flag `0x010c` is clear it advances the pointer by
  two, stepping over a two-byte operand; when set it does nothing. `[seen]` (both increments observed).
- **`loc_9bfa`** is a conditional goto: it advances the pointer, and when the branch flag is clear it
  reloads the pointer from the script operand, jumping to a target. `[seen]` (advance and table-reload
  writes observed).
- **`loc_9c17`** is the unconditional goto, reloading the pointer from the operand table; it is also the
  loop-back tail of a timer opcode, and runs very heavily. `[seen]`.
- **`loc_9bca`** clears the continuation flag `0x010a`, terminating the driver's inner walk — the
  "stop iterating" signal. `[seen]` (the flag clear is observed thousands of times).

Two opcodes are TEST instructions that produce the branch flag `0x010c` the skip/goto handlers read.
Both were dormant in the captured window, so their roles are `[code]`, exact but unconfirmed on
hardware:

- **`loc_9c21`** reads a slot's segment `0x02b9`, looks up a per-segment bound in the table at `0x03ac`
  (an absent entry reads as maximum), compares it to the slot's depth `0x02df`, and sets the branch flag
  from that comparison — a position-versus-boundary test consistent with a lane/segment limit. `[code]`.
- **`loc_9c3b`** sets the branch flag from bit arithmetic on the `0x0147`/`0x0148` accumulator pair
  (`0x0148` being a signed phase accumulator the driver advances by `0x0147`) — a phase/overflow test.
  `[code]`.

## Vector coordinate lists and the display cursor

The picture is assembled by walking coordinate lists and appending to the display list. A pointer into
the current coordinate list lives at `0x2c`/`0x2d`, and the running display cursor at `0x74`/`0x75`
sweeps AVG vector RAM.

- **`loc_9aee`** selects a coordinate list: indexed by a register it loads a pointer from the ROM tables
  `0x9b02` (low) / `0x9afd` (high) into `0x2c`/`0x2d` and records the chosen index at `0x2b`. `[seen]`
  (all three writes observed) — the producer the walkers below chase.
- **`loc_96cb`** steps the list cursor by an inter-entry delta: it differences an entry against its
  predecessor, stashes the step at `0x29`, and advances by that delta plus two. `[seen]` (the observed
  delta values are real inter-entry steps).
- **`loc_96db`** resolves a list entry to an absolute coordinate by adding the base `0x0160`; a pure
  compute helper with no memory write, reached through a computed jump, so `[code]`.
- **`loc_96c7`** advances the cursor past a packed record without reading it (a register-only skip of
  three or two bytes at its two entries); `[code]`, register-only.
- **`loc_df5f`** advances the 16-bit display cursor `0x74`/`0x75` by a count-plus-one, carrying into the
  high byte, sweeping the pointer across the `0x22xx-0x2fxx` vector RAM. `[seen]` — its callers are the
  vector-list builders, and the cursor is observed sweeping vector RAM continuously.

## Building and emitting draw pointers

Above the coordinate walkers sits the per-subsystem draw setup that aims the display cursor at the right
data before each subsystem's shapes are drawn.

- **`loc_b2be`** picks a two-byte pointer from one of two ROM tables (`0xce68` or `0xce7a`, chosen by the
  flag byte `0x0415`) and publishes it into the `0x74`/`0x75` indirect draw pointer. `[seen]`: the frame
  drawer calls it before each of several subsystem draws, and the published pointer is observed changing.
- **`loc_91b5`** loads an indexed pointer from the ROM table at `0x91c6` into the general working pointer
  `0x2a`/`0x2b`, clearing `0x29`; its caller then drives a three-byte indirect draw/copy from that
  pointer. `[seen]`.
- **`loc_c43c`** gathers an object's attributes into the draw working block: from the slot index `0x37` it
  copies four parallel attribute tables (`0x036a`→`0x61`, `0x035a`→`0x62`, `0x038a`→`0x63`,
  `0x037a`→`0x64`) that the shape drawer then consumes. `[seen]` (all four writes observed with varying
  values from real attribute arrays).
- **`loc_b896`** writes the cursor into the vector-RAM tail record (`0x2ffc`/`0x2ffd` with the high byte
  flagged, `0x2fff` a terminator) and decrements the cursor by a fixed stride; **`loc_b944`** swaps the
  `0x74`/`0x75` pointer with `0x76`/`0x77`; **`loc_b967`** selects one of two ROM pointer-table entries by
  the flag `0x0415` for its caller's draw struct. All three sit in an object-draw loop that stayed dormant
  in the captured window, so each is `[code]` — mechanism exact, reach unconfirmed.

## State-reset chains

When a mode or level begins, a chain of reset routines (entered through the init sequences around
`loc_902b`/`loc_9009`/`loc_90c4`) clears working blocks and seeds constants. These are legible as resets
and were reached under MAME, but the *game meaning* of each block is not yet settled, so the routines and
their cells keep `loc_` names:

- **`loc_921b`** seeds a fixed set of init constants across `0x0200`, `0x51`, `0x0106`, `0x0201`, `0x0202`.
  `[seen]` (reached; `0x0200` and `0x51` are real state cells that vary elsewhere, so this is a genuine
  seed).
- **`loc_9234`** sets a table header `0x03ab` from a per-level source `0x015b` and fills the 16-entry array
  `0x03ac..0x03bb` from `0x015a` — a per-lane-width table reset (sixteen entries matching the tube's
  segment count). `[seen]` on the header write.
- **`loc_926f`**, **`loc_928f`**, **`loc_929f`** each zero a working array (`0x02df..0x02e5`,
  `0x02d3..0x02de`, `0x030a..0x0311` respectively) plus a handful of associated flags; **`loc_92ad`** clears
  the single state byte `0x50`; **`loc_ca62`** clears the six-byte scratch/staging block `0x40..0x45` its
  caller then reads as two three-byte entries; **`loc_a831`** clears `0x03aa` and the latch `0x0125`. All
  `[seen]` (each was reached and its clears observed) except where a target is only ever cleared in the
  capture.
- **`loc_a789`** zeroes the 16-byte per-slot state table `0x0283..0x0292` and seeds five scalar cells
  (`0x010e`, `0x010d`, `0x01`, `0x68`, `0x69`); its caller runs it as part of a mode/level re-init. `[code]`:
  the whole per-slot enemy path was dormant in the capture, so the reset is legible from the code but
  MAME-unconfirmed here.
- **`loc_b0e7`** seeds startup work cells (`0x00`, `0x02`, `0x04`, `0x01`, `0x014e`, `0x014d`) with fixed
  constants; **`loc_c97b`** and **`loc_ca18`** are state-entry seeders of the zero-page config block
  `0x00-0x04` (with `loc_ca18` first masking the flag byte `0x05`), each writing a different constant set for
  its state. All `[seen]` as producers; the individual cells are constant-only in the capture so their own
  roles stay `[code]`.

## Enemy rim motion and the spike

Enemies travel around the rim of the tube by segment; a small cluster computes and applies their
direction. Most of this path was dormant in an attract-plus-brief-play capture, so it is `[code]` except
where a routine was independently reached:

- **`loc_a7a6`** computes the signed segment distance from a reference to a target (masking to a signed
  low nibble unless a full-byte flag `0x0111` is set); its consumers use the sign to set or clear an
  enemy's travel-direction bit. `[seen]` (the signed result is observed).
- **`loc_9c4f`** toggles bit 6 of a slot's state `0x0283` — the flip/travel-direction bit an enemy
  reverses at a segment limit. `[code]` (the enemy-flip path was dormant).
- **`loc_a69b`** returns a signed random step in the range −7..+7 from the POKEY random register `0x60da`,
  negating on a caller flag; its consumer is the enemy-spawn routine that fills velocity/coordinate deltas.
  `[code]` (spawn dormant in capture).
- **`loc_a7bd`** resets an eight-entry table (`0x03fe..0x0405`, seeding the last entry to a height value)
  and arms the flag `0x0115`; its caller runs it once a descending object passes a threshold, and the
  seeded entry is later observed draining as a live counter — consistent with the spiker's spike. `[seen]`.

## Utilities and shared tails

- **`loc_aaf5`** converts a binary byte to packed BCD by double-dabble (eight passes, decimal-mode
  accumulate) into `0x29`/`0x2c`, feeding an on-screen numeric field. `[seen]` (BCD-shaped values observed).
- **`loc_ac36`** sets the two pending-rebuild request bits in `0x01c9`, then falls through to a shared
  return; its request bits drive later block rebuilds. `[seen]`.
- **`loc_92b2`** swaps two 18-entry parallel arrays (`0x03aa` and `0x03bc`) slot-for-slot, and **`loc_b85f`**
  seeds two paired three-entry arrays; both are readable but were not reached in the capture, so `[code]`.
- **`loc_b955`** always returns the constant pair (2, 0): it reads `0x57` and runs a bit-count loop whose
  result is then discarded, so the shift/count is dead code and the constant is the only observable output —
  a trap for a name derived from the loop rather than the effect. `[code]`.
- **`loc_9bcf`**, **`loc_ac07`**, **`loc_ac3e`**, **`loc_af6e`** are bare-RTS handler/return tails a caller
  branches to when there is nothing to do (an empty dispatch slot, a "no rebuild needed" path, an empty draw
  path). No observable effect, so `[code]`; they are candidates to dissolve into their callers.

## Decompiled, understanding pending

A second leaf batch has since been rewritten to idiomatic JS (memory-equivalent, gated) but **not yet
grounded or named** — its routines and the cells they touch keep `loc_<addr>` placeholders and carry no
role claim here. They cover further arithmetic and bit-fold helpers, more state-table seed/clear routines,
additional vector-list and draw-pointer builders, and hardware-register (POKEY/mathbox/EAROM) access
routines. Their roles are established by the next understanding pass, which grounds them against MAME and
folds them into the sections above; until then this map makes no claim about them.

## Open edges

The motion-script TEST opcodes (`loc_9c21`, `loc_9c3b`), the enemy-flip and spawn path
(`loc_9c4f`, `loc_a69b`, `loc_a789`), the object-draw loop (`loc_b896`, `loc_b944`, `loc_b967`,
`loc_92b2`, `loc_b85f`), and `loc_c43c`'s deeper consumers were not exercised by an attract-plus-brief-play
capture; their roles are `[code]` pending a capture that reaches the states that drive them. The many
`loc_<addr>` cells the reset routines touch keep placeholder names because their game roles are legible
only once the routines that *consume* them (still translated) are decompiled — the naming compounds as the
call graph is climbed.
