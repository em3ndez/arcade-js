// SPDX-License-Identifier: GPL-3.0-only
/** loc_1319 — lay one byte across a fixed run of thirteen cells of a character line.
 * The cursor starts where the caller left it and steps back thirty-two addresses per cell, one
 * cell further along the line, so all thirteen come out uniform — a blanking character in the
 * character plane, a colour in the colour plane. LIVE-OUT: those thirteen cells, plus the
 * cell-step register left holding minus thirty-two, which callers walk on from without reloading
 * it. The run length is fixed here; the caller chooses only where it starts and what fills it. */

import { u16 } from "../../../core/int.js";

const RUN_CELLS = 13;
const CELL_STEP = -32;

export function loc_1319(m) {
  const { regs, mem8 } = m;
  const fill = regs.a;
  let cursor = regs.hl;
  for (let i = 0; i < RUN_CELLS; i++) {
    mem8[cursor] = fill;
    cursor = u16(cursor + CELL_STEP);
  }
  regs.de = u16(CELL_STEP);
}
