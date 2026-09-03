// SPDX-License-Identifier: GPL-3.0-only
import { coordToScreenAddr } from "./coordToScreenAddr.js";

// Latch L's low 3 bits as the shift offset, then fold the coordinate (HL by default) into the video-RAM
// window. `hl` is the same coordinate word coordToScreenAddr reads; threading it lets a caller pass the
// coordinate explicitly instead of seating it in the register first (every existing caller omits it).
export function seatBlitPosition(m, l = m.regs.l, hl = m.regs.hl) {
  m.io.portOut(0x02, l & 0x07);
  return coordToScreenAddr(m, hl);
}
