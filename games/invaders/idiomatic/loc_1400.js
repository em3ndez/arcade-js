// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

// OR-blit a hardware-shifted sprite column: seat the blit, then per row push one source byte through
// the shifter and merge its two overlapping halves into the adjacent screen bytes, stepping one screen
// row down each pass. Live-out: HL (column end) and DE (source end).
export function loc_1400(m, de = m.regs.de, b = m.regs.b) {
  let dst = seatBlitPosition(m);
  let src = de;
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  for (let i = 0; i < rows; i++) {
    m.io.portOut(0x04, m.mem8[src]);
    m.mem8[dst] = m.io.portIn(0x03) | m.mem8[dst];
    src = u16(src + 1);
    const hi = u16(dst + 1);
    m.io.portOut(0x04, 0x00);
    m.mem8[hi] = m.io.portIn(0x03) | m.mem8[hi];
    dst = u16(dst + 0x20);
  }
  return [(m.regs.hl = dst), (m.regs.de = src)];
}
