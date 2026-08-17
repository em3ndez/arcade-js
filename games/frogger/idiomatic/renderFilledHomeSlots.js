// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFilledHomeSlots — stamp the frog-home tiles for each occupied home slot.
 *
 * For each non-zero entry in the occupancy list at HL, stamp four home tiles at its base.
 * LIVE-OUT: memory-only.
 */
import { HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM } from "./names.js";

const SLOT_BASES = [HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM];
const ROW_BELOW = 32;

export function renderFilledHomeSlots(m) {
  const { mem8 } = m;
  const list = m.regs.hl;
  for (let i = 0; i < SLOT_BASES.length; i++) {
    if (mem8[(list + i)] === 0) continue;
    const base = SLOT_BASES[i];
    mem8[base] = 108;
    mem8[(base + 1)] = 109;
    mem8[(base + ROW_BELOW)] = 110;
    mem8[(base + ROW_BELOW + 1)] = 111;
  }
}
