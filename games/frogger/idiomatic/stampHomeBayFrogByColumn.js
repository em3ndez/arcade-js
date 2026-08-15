// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFrogByColumn — board-complete "all frogs home" reveal dispatcher, keyed on the
 * home-column selector. Five descending selector values each stamp the 2x2 frog-in-home graphic into
 * one bay's fixed VRAM base, revealing the bays in sequence as the reveal countdown passes each
 * threshold; the fill-all selector delegates to fillAllHomeSlotsAndAwardLife (which resets the bays to
 * the empty home tile and awards the life); any other value does nothing. LIVE-OUT: memory-only.
 */
import { loc_ab64, loc_aaa4, loc_a9e4, loc_a924, loc_a864 } from "./names.js";
import { fillAllHomeSlotsAndAwardLife } from "./fillAllHomeSlotsAndAwardLife.js";

const ROW = 32;
const FROG_TILE = 252; // first of four consecutive frog-in-home tiles

const BAY_BASE_BY_COLUMN = new Map([
  [192, loc_ab64],
  [144, loc_aaa4],
  [112, loc_a9e4],
  [80, loc_a924],
  [48, loc_a864],
]);
const FILL_ALL_COLUMN = 16;

export function stampHomeBayFrogByColumn(m, homeColumn = m.regs.a) {
  const base = BAY_BASE_BY_COLUMN.get(homeColumn);
  if (base !== undefined) return stampBayFrog(m, base);
  if (homeColumn === FILL_ALL_COLUMN) return fillAllHomeSlotsAndAwardLife(m);
}

// Stamp the bay's 2x2 frog-in-home graphic: four consecutive tiles across the top and bottom rows.
function stampBayFrog(m, base) {
  const { mem8 } = m;
  mem8[base] = FROG_TILE;
  mem8[(base + 1) & 0xffff] = FROG_TILE + 1;
  mem8[(base + ROW) & 0xffff] = FROG_TILE + 2;
  mem8[(base + ROW + 1) & 0xffff] = FROG_TILE + 3;
}
