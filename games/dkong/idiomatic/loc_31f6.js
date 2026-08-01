// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_31f6 — pick a byte from the two timing-entropy cells: the low two bits of the
 * random accumulator, or the frame counter in the single case those bits are 1.
 * ROM 0x31F6.
 *
 * A leaf value helper. It looks at the low two bits of the random accumulator:
 *   - if they are anything other than 1 (so 0, 2, or 3) it returns that value;
 *   - if they are exactly 1 it returns the current frame counter instead.
 * It reads only those two cells and writes nothing, handing the byte back to its
 * single caller (which immediately compares it against 1), so the returned byte is
 * the whole point of the routine.
 *
 * Name kept neutral: the mechanism is pinned to the oracle, but what the caller
 * ultimately does with this byte is not yet visible — the only caller sits in the
 * still-untranslated object-processor chain — so the game-purpose is unconfirmed.
 * Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-31f6.test.js.
 * GATE:     exhaustive — the result is a pure function of two bytes (RANDOM, FRAME),
 *           swept over the whole 256×256 input space; plus crafted spreads laid over a
 *           real attract-base machine (to catch any accidental dependence on other RAM).
 *           The natural caller chain (entry_31b1 -> sub_31dd -> here) is not yet wired
 *           into the live dispatcher, so attract mints no captured dispatches; the
 *           exhaustive sweep is the complete proof and the capture pass logs the (zero)
 *           natural count for transparency. Teeth: a twin that inverts the branch and a
 *           twin that returns the wrong entropy source.
 * LIVE-OUT: the returned byte — the value the oracle leaves in the accumulator, which
 *           its caller consumes immediately. No RAM is written; the oracle's residual
 *           flags and its `ret` pop are dead.
 * NAMES:    RANDOM (0x6018), FRAME (0x601A) — both from ram.js.
 */

import { RANDOM, FRAME } from "./ram.js";

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
