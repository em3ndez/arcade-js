// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_EXTEND_INDEX, ROPE_CELL_STATE_BASE } from "./names.js";
/**
 * loc_2e22 — drive every active rope cell through its per-cell handler.
 *
 * The active-cell count gates the pass: zero cells returns at once. Otherwise it walks the
 * per-cell state array from its base, one cell per step, handing each cell record to the
 * rope-cell dispatcher.
 *
 * LIVE-OUT: none — a void driver; the caller only sequences it and returns. All effect lives
 * in memory (the per-cell records the dispatcher touches).
 */
export function loc_2e22(m) {
  const count = m.mem8[ROPE_EXTEND_INDEX];
  for (let i = 0; i < count; i++) {
    m.regs.ix = ROPE_CELL_STATE_BASE + i; // dispatcher reads the cell pointer from IX
    m.push16(0x2e30); // return slot the dispatcher's ret consumes
    m.call(0x2e36);
  }
}
