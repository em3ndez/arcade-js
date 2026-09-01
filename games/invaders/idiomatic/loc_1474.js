// SPDX-License-Identifier: GPL-3.0-only
import { coordToScreenAddr } from "./coordToScreenAddr.js";

// Latch L's low 3 bits as the shift offset, then fold HL into the video-RAM window.
export function loc_1474(m, l = m.regs.l) {
  m.io.portOut(0x02, l & 0x07);
  return coordToScreenAddr(m);
}
