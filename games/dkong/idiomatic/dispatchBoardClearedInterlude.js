// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardClearedInterlude — top dispatcher for the board-advance state, keyed on board type.
 * Parks the moving sprite groups off-screen, then routes the interlude's current step: odd boards
 * (25m/75m) vector through a 6-entry target table, 50m through a 5-entry table, and 100m falls
 * through to the rivet-board interlude frame.
 *
 * LIVE-OUT: memory-only — the parked sprite bytes plus the dispatched arm's writes.
 */

import { BOARD, BOARD_ADVANCE_STEP } from "./names.js";
import { clearSpriteColumns } from "./clearSpriteColumns.js";
import { runRivetBoardInterludeFrame } from "./runRivetBoardInterludeFrame.js";
import { loc_00ca } from "../translated/loc_00ca.js";

const STEP_TABLE_ODD = 0x1623; // 25m / 75m
const STEP_TABLE_50M = 0x1637; // 50m

const DISPATCH_TABLE_1623 = "0x1623 (0x6388 board sub-dispatch)";
const DISPATCH_TABLE_1637 = "0x1637 (0x6388 board sub-dispatch)";

// Vector the step through a table of little-endian targets; the step index is doubled to a byte
// offset with the hardware's 8-bit wrap.
function dispatchBoardRenderStep(m, tableBase, site) {
  const { mem8 } = m;
  const step = mem8[BOARD_ADVANCE_STEP];
  const entry = (tableBase + ((step * 2) & 0xff)) & 0xffff;
  const target = mem8[entry] | (mem8[(entry + 1) & 0xffff] << 8);
  loc_00ca(m, target, site);
}

export function dispatchBoardClearedInterlude(m) {
  const { mem8 } = m;

  clearSpriteColumns(m);

  const board = mem8[BOARD];
  if ((board & 0x01) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_ODD, DISPATCH_TABLE_1623);
  } else if ((board & 0x02) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_50M, DISPATCH_TABLE_1637);
  } else {
    runRivetBoardInterludeFrame(m);
  }
}
