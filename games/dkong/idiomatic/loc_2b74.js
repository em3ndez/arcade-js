// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b74 — the reject arm of the tile-probe cascade: hand back a zeroed result and
 * unwind out of the probe and its caller.
 *
 * Reached only from the descent probe's head, on the branch taken when the probe's vertical
 * delta is out of range. It forces the probe's two result registers to zero and then UNWINDS
 * two levels, splicing straight past the probe's caller so the rest of that pass is skipped.
 * In direct-call form that non-local exit is a boolean: it returns false, the caller-skip
 * signal meaning "abort — no result this pass".
 *
 * The two zeroed registers are the probe's result, and they are LIVE: after the unwind, the
 * consumer reads them straight back, decrementing the first to decide its branch and, on a
 * sibling arm, the second for the next. The zeros are the answer this arm reports, not dead
 * scratch, which is why they are written as registers here.
 *
 * A LEAF: reads nothing, writes no memory, calls nothing — a constant function of no input.
 * Its only "input" is the return stack it unwinds, which is dead scratch.
 *
 * WHY THE NEUTRAL NAME: the mechanism is exact — zero the two result registers, caller-skip
 * unwind — but what the (0, 0) result MEANS to the game is not established here, so an
 * English name would have to guess.
 *
 * LIVE-OUT: the two result registers, both zero, plus the boolean unwind signal. It writes no
 * memory. The residual HL, which holds the discarded return address, and the flags are dead.
 */

export function loc_2b74(m) {
  const { regs } = m;

  // Report the "no result" answer: the probe's two result registers go to zero. The code
  // past the probe's caller reads these back directly, so they are genuinely live-out.
  regs.a = 0;
  regs.b = 0;

  // Caller-skip: unwind out of the probe and its caller so the rest of the pass is skipped.
  // The boolean replaces the two-level return the hardware performs.
  return false;
}
