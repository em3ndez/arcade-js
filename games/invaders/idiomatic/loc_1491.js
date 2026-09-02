// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";
import { loc_2061 } from "./names.js";

// Draw B sprite rows with collision detect: seat the shift offset, clear the collision flag, then per
// row OR the hardware-shifted source byte into two adjacent screen columns, flagging any overlap.
export function loc_1491(m, de = m.regs.de, b = m.regs.b) {
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  let dst = seatBlitPosition(m); // screen address for the first row
  let src = de;
  m.mem8[loc_2061] = 0;
  let a = 0;
  for (let r = 0; r < rows; r++) {
    const rowStart = dst;
    m.io.portOut(0x04, m.mem8[src]);
    let shifted = m.io.portIn(0x03);
    if (shifted & m.mem8[dst]) m.mem8[loc_2061] = 1;
    a = shifted | m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(dst + 1);
    src = u16(src + 1);
    m.io.portOut(0x04, 0);
    shifted = m.io.portIn(0x03);
    if (shifted & m.mem8[dst]) m.mem8[loc_2061] = 1;
    a = shifted | m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(rowStart + 0x20);
  }
  return [m.regs.hl = dst, m.regs.de = src, m.regs.a = a];
}
