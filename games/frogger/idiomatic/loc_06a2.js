// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06a2 — home-slot marker dispatcher keyed on the home-column selector.
 * Five selector values each stamp one slot's empty 2x2 marker at that slot's fixed VRAM base; a
 * sixth value fills all five slots and awards the completion life; any other value does nothing.
 * LIVE-OUT: memory-only.
 */
import { loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864 } from "./names.js";
import { fillAllHomeSlotsAndAwardLife } from "./fillAllHomeSlotsAndAwardLife.js";

const ROW = 32;
const MARKER_TILE = 252; // first of four consecutive empty-slot marker tiles

const SLOT_BASE_BY_COLUMN = new Map([
  [192, loc_ab64],
  [144, loc_aaa4],
  [112, loc_a9e4],
  [80, loc_a924],
  [48, loc_a864],
]);
const FILL_ALL_COLUMN = 16;

export function loc_06a2(m, homeColumn = m.regs.a) {
  const base = SLOT_BASE_BY_COLUMN.get(homeColumn);
  if (base !== undefined) return stampEmptySlotMarker(m, base);
  if (homeColumn === FILL_ALL_COLUMN) return fillAllHomeSlotsAndAwardLife(m);
}

// Stamp the slot's empty 2x2 marker: four consecutive tiles across the top and bottom rows.
function stampEmptySlotMarker(m, base) {
  const { mem8 } = m;
  mem8[base] = MARKER_TILE;
  mem8[(base + 1) & 0xffff] = MARKER_TILE + 1;
  mem8[(base + ROW) & 0xffff] = MARKER_TILE + 2;
  mem8[(base + ROW + 1) & 0xffff] = MARKER_TILE + 3;
}
