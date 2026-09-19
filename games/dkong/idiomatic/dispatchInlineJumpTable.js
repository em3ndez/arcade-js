// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInlineJumpTable — inline-jump-table trampoline: pop the table base the caller pushed as
 * data, read the little-endian word at table[selector], and dispatch to it. The shared
 * computed-dispatch primitive; steered only by the selector and the table base on the stack.
 *
 * LIVE-OUT: the stack pointer past the consumed base, the arm's memory writes, and the arm's skip
 * boolean, which this routine propagates unchanged.
 */
import { u16 } from "../../../core/int.js";
import { loc_00ca } from "../translated/loc_00ca.js";

export function dispatchInlineJumpTable(m, site = "0x00CA (NMI game state)", a = m.regs.a) {
  const { regs, mem8 } = m;

  // Double the selector into a byte offset: an 8-bit result, so 0x80 wraps to 0.
  regs.add(a);

  regs.hl = m.pop16();

  regs.e = regs.a;
  regs.d = 0x00;
  regs.addHl(regs.de);

  regs.e = mem8[regs.hl];
  regs.hl = u16(regs.hl + 1);
  regs.d = mem8[regs.hl];

  regs.exDeHl();

  return loc_00ca(m, regs.hl, site);
}
