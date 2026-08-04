// SPDX-License-Identifier: GPL-3.0-only
/**
 * stirRandomSeed — mix the pseudo-random seed once per vblank.  ROM 0x0057.
 *
 * Donkey Kong has no hardware RNG; it manufactures entropy by summing two counters
 * that advance at unrelated rates. Each vblank this routine adds FRAME (0x601A,
 * DECREMENTED by the NMI) and SPIN_COUNT (0x6019, INCREMENTED once per main-loop
 * pass) into the seed RANDOM (0x6018) and stores the 8-bit sum back:
 *
 *     RANDOM = (RANDOM + FRAME + SPIN_COUNT) & 0xff
 *
 * Because SPIN_COUNT's rate depends on how much work each frame's code did, the
 * running sum is unpredictable enough to drive enemy spawns and difficulty coin-
 * flips — the readers of RANDOM (ROM 0x2186's `ld a,(0x6018) / and 0x03 / cp b`
 * difficulty gate, sub_2523's spawn roll, sub_306f, …). A PURE LEAF: reads three
 * RAM bytes, writes one, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0057.test.js.
 * GATE:     input-sweep (full seed×frame grid at boundary spin values + all-256
 *           spin breadth at seed/frame edges — covers every 8-bit-sum wraparound;
 *           the body is branch-free, so there are no unreached arms) + real captured
 *           vblank dispatches. Teeth: a twin that drops the FRAME term.
 * LIVE-OUT: memory RANDOM (0x6018); + register A (the fresh seed — every caller
 *           consumes it immediately: entry_2c41/spawnObjectIntoInactiveSlot `and 0x0f`, sub_306f
 *           `and 0x80`, sub_2523 `cp 0x60`); + register HL == 0x6019, because
 *           sub_2523's spawn tail runs `dec (hl)` on the HL this routine leaves,
 *           so the closing `ld hl,0x6019` is LOAD-BEARING, not dead. Flags are
 *           DEAD — every caller recomputes them (and/cp) or issues a call before
 *           branching. (No pc/SP: the Z80 `ret` is modelled by the JS return.)
 * NAMES:    RANDOM (0x6018), FRAME (0x601A), SPIN_COUNT (0x6019) — names.js.
 */
import { RANDOM, FRAME, SPIN_COUNT } from "./names.js";

export function stirRandomSeed(m) {
  const { regs, mem } = m;

  // Each `add a,(hl)` wraps at 8 bits; the low byte of a sum is associative, so
  // the two chained adds fold into one masked expression.
  const seed = (mem.read8(RANDOM) + mem.read8(FRAME) + mem.read8(SPIN_COUNT)) & 0xff;
  mem.write8(RANDOM, seed);

  // Live-out registers, in the state the oracle's `ret` hands back.
  regs.a = seed;         // callers immediately and/cp on the fresh seed
  regs.hl = SPIN_COUNT;  // 0x6019 — sub_2523's spawn tail does `dec (hl)` on it
}
