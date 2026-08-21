// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * loc_0010 — fill a run of bytes with a constant, advancing the pointer.
 * The count is the loop counter; a zero counter means a full 256 (the djnz wrap).
 * LIVE-OUT: the advanced pointer (start + count) in HL, AND the drained counter B = 0 (the
 * djnz loop exits at B==0, and callers read that zero); both set via the return-assignment.
 */
export function loc_0010(m, start = m.regs.hl, fill = m.regs.a, len = m.regs.b) {
  const { mem8 } = m;
  const count = len === 0 ? 256 : len;
  let cell = start;
  for (let i = 0; i < count; i++) {
    mem8[cell] = fill;
    cell = u16(cell + 1);
  }
  return (m.regs.b = 0), (m.regs.hl = cell);
}
