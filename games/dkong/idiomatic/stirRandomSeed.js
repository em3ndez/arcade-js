// SPDX-License-Identifier: GPL-3.0-only
/**
 * stirRandomSeed — mix the pseudo-random seed once per vblank.
 *
 * The machine has no hardware random-number source, so entropy is manufactured by summing
 * two counters that advance at unrelated rates. Each vblank this adds the frame counter —
 * decremented once per vertical blank — and the spin counter — incremented once per pass
 * of the main loop — into the seed, and stores the 8-bit sum back:
 *
 *     seed = (seed + frame + spin) & 0xff
 *
 * The spin counter's rate depends on how much work each frame's code actually did, which is
 * what makes the running sum unpredictable enough to drive spawns and difficulty coin-flips.
 *
 * A PURE LEAF: reads three bytes, writes one, calls nothing.
 *
 * Reads: the seed, the frame counter, the spin counter. Writes: the seed.
 *
 * LIVE-OUT: the seed in memory, plus two registers callers genuinely consume — the fresh
 * seed byte, which every caller masks or compares immediately, and a pointer to the spin
 * counter, which one caller's spawn tail decrements in place. The pointer is load-bearing,
 * not leftover.
 */
import { RANDOM, FRAME, SPIN_COUNT } from "./names.js";

export function stirRandomSeed(m) {
  const { regs, mem } = m;

  // Each addition wraps at 8 bits, and the low byte of a sum is associative, so the two
  // chained adds fold into one masked expression.
  const seed = (mem.read8(RANDOM) + mem.read8(FRAME) + mem.read8(SPIN_COUNT)) & 0xff;
  mem.write8(RANDOM, seed);

  // The two live-out registers.
  regs.a = seed;         // callers mask or compare the fresh seed straight away
  regs.hl = SPIN_COUNT;  // a spawn tail decrements the spin counter through this pointer
}
