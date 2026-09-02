// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

// Pre-shift each of B source rows through the hardware shift register, laying each down as two bytes one screen-stride apart from the seated address.
export function loc_15d3(m, de = m.regs.de, b = m.regs.b) {
  const base = seatBlitPosition(m);
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  let src = de;
  let dst = base;
  for (let i = 0; i < rows; i++) {
    m.io.portOut(0x04, m.mem8[src]);
    m.mem8[dst] = m.io.portIn(0x03);
    m.io.portOut(0x04, 0);
    m.mem8[u16(dst + 1)] = m.io.portIn(0x03);
    src = u16(src + 1);
    dst = u16(dst + 0x20);
  }
  return [(m.regs.hl = base), (m.regs.de = src), (m.regs.b = 0)];
}
