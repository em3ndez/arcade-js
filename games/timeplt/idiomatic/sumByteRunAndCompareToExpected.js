// SPDX-License-Identifier: GPL-3.0-only
/** sumByteRunAndCompareToExpected — add a run of bytes together and answer whether the total is the one the caller
 * named. The run is walked forward from a pointer; the length arrives as a count that means a
 * full 256 when it is zero, and the total wraps at eight bits. Nothing is written, and both of
 * its exits are the same exit — the answer is left for the caller rather than acted on here.
 * The image's one caller reloads the accumulator, pointer, counter and flags before reading any,
 * so the total, walked pointer and spent count are not handed back. LIVE-OUT: the answer, returned. */

import { u8, u16 } from "../../../core/int.js";

const LENGTH_ZERO_MEANS = 256;

export function sumByteRunAndCompareToExpected(m, base = m.regs.hl, length = m.regs.b, expected = m.regs.c) {
  const { mem8 } = m;
  const run = length === 0 ? LENGTH_ZERO_MEANS : length;
  let total = 0;
  for (let i = 0; i < run; i++) total = u8(total + mem8[u16(base + i)]);
  return total === expected;
}
