// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

// Clear a two-wide sprite column: seat the blit, then zero the two adjacent screen bytes on each of
// B rows, stepping one screen row down each pass. Live-out: HL (column end).
export function loc_1424(m, b = m.regs.b) {
  let dst = seatBlitPosition(m);
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  for (let i = 0; i < rows; i++) {
    m.mem8[dst] = 0;
    m.mem8[u16(dst + 1)] = 0;
    dst = u16(dst + 0x20);
  }
  return (m.regs.hl = dst);
}
