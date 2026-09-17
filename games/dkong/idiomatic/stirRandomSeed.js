// SPDX-License-Identifier: GPL-3.0-only
/**
 * stirRandomSeed — mix the pseudo-random seed once per vblank: seed = (seed + frame + spin) & 0xff.
 *
 * LIVE-OUT: the seed in memory, plus two registers callers consume — the fresh seed byte (a), and
 * a pointer to the spin counter (hl), which one caller's spawn tail decrements in place.
 */
import { RANDOM, FRAME, SPIN_COUNT } from "./names.js";

export function stirRandomSeed(m) {
  const { regs, mem8 } = m;

  const seed = (mem8[RANDOM] + mem8[FRAME] + mem8[SPIN_COUNT]) & 0xff;
  mem8[RANDOM] = seed;

  regs.a = seed;
  regs.hl = SPIN_COUNT;
}
