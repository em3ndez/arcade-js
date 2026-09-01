// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

// Block-copy a rectangle: read C bytes from each of B source rows (one screen row apart) into a
// contiguous destination stream. Live-out: the destination end pointer and the advanced source base.
export function captureScreenRect(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b, c = m.regs.c) {
  const rows = b || 256; // a count of 0 wraps to a full 256-pass loop
  const cols = c || 256;
  let dst = de;
  for (let r = 0; r < rows; r++) {
    let src = u16(hl + 0x20 * r);
    for (let k = 0; k < cols; k++) {
      m.mem8[dst] = m.mem8[src];
      dst = u16(dst + 1);
      src = u16(src + 1);
    }
  }
  return [m.regs.de = dst, m.regs.hl = u16(hl + 0x20 * rows)];
}
