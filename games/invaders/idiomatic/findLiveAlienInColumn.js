// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// Scan five object slots (stride 0x0b) on page ACTIVE_PLAYER_PAGE from low byte C-1: carry is set on the
// first non-empty slot, else it is whatever the final pointer add produced. Three live-outs the caller
// reads: the carry, C decremented once, and L -- the found slot's low byte, fed to alienIndexToScreenCoords.
export function findLiveAlienInColumn(m, c = m.regs.c) {
  c = (c - 1) & 0xff;
  const page = m.mem8[ACTIVE_PLAYER_PAGE];
  let l = c;
  let carry = false;
  for (let d = 5; d > 0; d--) {
    if (m.mem8[(page << 8) | l] !== 0) return [m.regs.fC = true, m.regs.c = c, m.regs.l = l];
    const sum = l + 0x0b;
    carry = sum > 0xff;
    l = sum & 0xff;
  }
  return [m.regs.fC = carry, m.regs.c = c, m.regs.l = l];
}
