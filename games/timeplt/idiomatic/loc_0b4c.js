// SPDX-License-Identifier: GPL-3.0-only
/** loc_0b4c — add a run of bytes together and answer whether the total is the one the caller
 * named. The run is walked forward from a pointer; the length arrives as a count that means a
 * full 256 when it is zero, and the total wraps at eight bits. Nothing is written, and both of
 * its exits are the same exit — the answer is left for the caller rather than acted on here.
 * LIVE-OUT: the answer, returned and mirrored into the flags the comparison leaves; the total;
 * the pointer standing one past the run; and the length counted down to nothing. */

import { u8, u16 } from "../../../core/int.js";

const LENGTH_ZERO_MEANS = 256;

export function loc_0b4c(m, base = m.regs.hl, length = m.regs.b, expected = m.regs.c) {
  const { regs, mem8 } = m;
  const run = length === 0 ? LENGTH_ZERO_MEANS : length;
  let total = 0;
  for (let i = 0; i < run; i++) total = u8(total + mem8[u16(base + i)]);
  regs.a = total;
  regs.hl = u16(base + run);
  regs.b = 0;
  regs.cp(expected);
  return total === expected;
}
