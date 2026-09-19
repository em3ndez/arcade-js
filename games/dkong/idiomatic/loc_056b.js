// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_056b — thin front end to the shared packed-BCD column renderer: pick one of two destination
 * video columns from a zero/nonzero selector, then render the 3-byte counter at the caller's source
 * pointer up that column, one tilemap row per digit. Selector and source both arrive in registers.
 *
 * LIVE-OUT: memory-only — the six digit cells the renderer writes into video RAM.
 */
import { renderBcdColumn } from "./renderBcdColumn.js"; // caller-column BCD renderer
import {
  P1_SCORE_COLUMN_BASE,
  SCORE_VRAM_COLUMN_P2,
} from "./names.js";


export function loc_056b(m, selector = m.regs.a) {
  const { regs } = m;

  regs.ix = selector === 0 ? P1_SCORE_COLUMN_BASE : SCORE_VRAM_COLUMN_P2;

  renderBcdColumn(m);
}
