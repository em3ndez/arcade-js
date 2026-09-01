// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// Build a record pointer: low byte from the index math, high byte the record-page cell.
export function loc_1581(m, index = m.regs.b, offset = m.regs.c) {
  const rot = ((index << 3) | (index >> 5)) & 0xff;
  const low = (rot + 3 * index + offset - 1) & 0xff;
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | low);
}
