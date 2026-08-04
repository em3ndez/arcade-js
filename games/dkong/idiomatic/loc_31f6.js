// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_31f6 — pick a byte from the two timing-entropy cells: the low two bits of the random
 * accumulator, or the frame counter in the single case those bits are 1.
 *
 * A leaf value helper. It looks at the low two bits of the random accumulator:
 *   - if they are anything other than 1 (so 0, 2, or 3) it returns that value;
 *   - if they are exactly 1 it returns the current frame counter instead.
 * It reads only those two cells and writes nothing, handing the byte back to its single
 * caller, which immediately compares it against 1 — so the returned byte is the whole point
 * of the routine.
 *
 * WHAT THIS DOES NOT CLAIM: what the caller ultimately does with the byte. The selection
 * itself is certain; its game purpose is not established.
 *
 * LIVE-OUT: the returned byte. No memory is written.
 */

import { RANDOM, FRAME } from "./names.js";

/**
 * @param {object} m  the machine (reads m.mem only).
 * @returns {number}  the selected byte: the low two bits of RANDOM, or FRAME when those
 *                    bits are exactly 1.
 */
export function loc_31f6(m) {
  const { mem } = m;

  // Low two bits of the random accumulator.
  const lowBits = mem.read8(RANDOM) & 0x03;

  // Anything but 1 (i.e. 0, 2, or 3) is the answer; exactly 1 substitutes the frame counter.
  if (lowBits !== 1) return lowBits;
  return mem.read8(FRAME);
}
