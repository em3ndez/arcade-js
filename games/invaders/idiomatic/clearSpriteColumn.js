// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

// Clear a two-wide sprite column: seat the blit, then zero the two adjacent screen bytes on each of
// B rows, stepping one screen row down each pass. Live-out: HL (column end). `hl` is the coordinate word
// to clear (defaults to the register); the shift offset and the folded address both derive from it, so a
// caller may pass it explicitly instead of seating HL first (every existing caller omits it).
export function clearSpriteColumn(m, b = m.regs.b, hl = m.regs.hl) {
  let dst = seatBlitPosition(m, hl & 0xff, hl);
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  for (let i = 0; i < rows; i++) {
    m.mem8[dst] = 0;
    m.mem8[u16(dst + 1)] = 0;
    dst = u16(dst + 0x20);
  }
  return (m.regs.hl = dst);
}
