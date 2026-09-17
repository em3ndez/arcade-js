// SPDX-License-Identifier: GPL-3.0-only
/** sumByteRunAndCompareToExpected — add a run of bytes together and answer whether the total is the one the caller
 * named. The run is walked forward from a pointer; the length arrives as a count that means a
 * full 256 when it is zero, and the total wraps at eight bits. Nothing is written, and both of
 * its exits are the same exit — the answer is left for the caller rather than acted on here.
 * LIVE-OUT: the answer, returned and mirrored into the flags the comparison leaves; the total;
 * the pointer standing one past the run; and the length counted down to nothing. */

import { u8, u16 } from "../../../core/int.js";
import { F_S, F_Z, F_F3, F_F5, F_N, F_C, F_H, F_PV } from "../../../core/cpu/z80.js";

const LENGTH_ZERO_MEANS = 256;

export function sumByteRunAndCompareToExpected(m, base = m.regs.hl, length = m.regs.b, expected = m.regs.c) {
  const { mem8 } = m;
  const run = length === 0 ? LENGTH_ZERO_MEANS : length;
  let total = 0;
  for (let i = 0; i < run; i++) total = u8(total + mem8[u16(base + i)]);

  // Flags the `cp expected` comparison leaves, with the total in A.
  const difference = total - expected;
  const remainder = difference & 0xff;
  const flags =
    (remainder & 0x80 ? F_S : 0) |
    (remainder === 0 ? F_Z : 0) |
    (expected & (F_F3 | F_F5)) |
    F_N |
    (difference < 0 ? F_C : 0) |
    (((total ^ expected ^ remainder) & 0x10) ? F_H : 0) |
    (((total ^ expected) & (total ^ remainder) & 0x80) ? F_PV : 0);

  return (m.regs.a = total, m.regs.hl = u16(base + run), m.regs.b = 0, m.regs.f = flags, total === expected);
}
