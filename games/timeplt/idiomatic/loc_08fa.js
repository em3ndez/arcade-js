// SPDX-License-Identifier: GPL-3.0-only
/** loc_08fa — the checksum-failure landing, whose bytes are really a read-as-data table.
 * A sound image passes the check and control never arrives; when it does, the table bytes
 * run as code and always fault. Carry clear stores into program space, which the bus refuses.
 * Carry set shuffles the index registers, spills one or two words onto the stack around the
 * seat, then jumps into unmapped space, which faults too. LIVE-OUT: none — every path throws. */

import { loc_2f01, loc_bc00, loc_c600, loc_de00 } from "./names.js";

export function loc_08fa(m) {
  const { regs, mem8 } = m;

  if (!regs.fC) {
    mem8[loc_2f01] = regs.a;
    return;
  }

  regs.l = regs.l - 1;
  regs.h = regs.h + 1;
  regs.e = 0x01;
  const hi = (m.pop16() >> 8) & 0xff;
  regs.exDeHl();
  m.push16(regs.hl);
  if (!parityEven(hi)) return m.call(loc_de00);
  m.push16(regs.de);
  regs.de = m.pop16();
  if (hi === 0) return m.call(loc_c600);
  return m.call(loc_bc00);
}

function parityEven(v) {
  let p = v ^ (v >> 4);
  p ^= p >> 2;
  p ^= p >> 1;
  return (p & 1) === 0;
}
