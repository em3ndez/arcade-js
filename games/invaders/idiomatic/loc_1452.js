// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

// Erase B sprite rows: seat the shift offset, then per row clear the hardware-shifted source bits
// from two adjacent screen columns, stepping down one screen row each pass.
export function loc_1452(m, de = m.regs.de, b = m.regs.b) {
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  let dst = seatBlitPosition(m); // screen address for the first row
  let src = de;
  let a = 0;
  for (let r = 0; r < rows; r++) {
    const rowStart = dst;
    m.io.portOut(0x04, m.mem8[src]);
    a = (m.io.portIn(0x03) ^ 0xff) & m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(dst + 1);
    src = u16(src + 1);
    m.io.portOut(0x04, 0);
    a = (m.io.portIn(0x03) ^ 0xff) & m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(rowStart + 0x20);
  }
  return [m.regs.hl = dst, m.regs.de = src, m.regs.a = a];
}
