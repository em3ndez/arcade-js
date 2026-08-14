// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFilledHomeSlots — stamp the frog-home tiles for each occupied home slot.
 *
 * For each non-zero entry in the occupancy list at HL, stamp four home tiles at its base.
 * LIVE-OUT: memory-only.
 */
import { loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864 } from "./names.js";

const SLOT_BASES = [loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864];
const ROW_BELOW = 32;

export function renderFilledHomeSlots(m) {
  const { mem8 } = m;
  const list = m.regs.hl;
  for (let i = 0; i < SLOT_BASES.length; i++) {
    if (mem8[(list + i) & 0xffff] === 0) continue;
    const base = SLOT_BASES[i];
    mem8[base] = 108;
    mem8[(base + 1) & 0xffff] = 109;
    mem8[(base + ROW_BELOW) & 0xffff] = 110;
    mem8[(base + ROW_BELOW + 1) & 0xffff] = 111;
  }
}
