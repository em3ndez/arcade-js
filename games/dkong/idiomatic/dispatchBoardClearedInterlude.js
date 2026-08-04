// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardClearedInterlude — top dispatcher for the board-advance state, keyed on the
 * board type.
 *
 * Reached once per frame while a board is being cleared and the game advances to the next
 * one. It first parks the moving sprite groups off-screen, then routes the interlude's
 * current step to the handler for the CURRENT board type:
 *
 *   - Odd board (BOARD bit0 set: 25m or 75m) -> vector the sequence step through a 6-entry
 *     table of targets (steps 0..5).
 *   - 50m board (BOARD bit1 set) -> vector through a 5-entry table (steps 0..4).
 *   - 100m board (neither bit) -> fall through to the rivet-board interlude frame, which
 *     runs the effect-sprite state machine and then dispatches the same sequence through
 *     its own table.
 *
 * In both table arms the step index is BOARD_ADVANCE_STEP; the little-endian target word is
 * read from the table at that index and handed to the generic computed-jump dispatcher.
 * Nothing at this level consumes a return value.
 *
 * The name deliberately drops "how high": the HOW HIGH screen is painted from the
 * board-setup state, not from this one. It also asserts nothing about what the arms DEPICT —
 * the figure they animate is identified from screenshots rather than from the bytes, and
 * that caveat belongs to each step handler.
 *
 * LIVE-OUT: memory-only — the parked sprite bytes plus the dispatched arm's writes.
 */

import { BOARD, BOARD_ADVANCE_STEP } from "./names.js";
import { clearSpriteColumns } from "./clearSpriteColumns.js";
import { runRivetBoardInterludeFrame } from "./runRivetBoardInterludeFrame.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The two inline jump tables of board-render step targets, selected by board type: six
// entries for the odd boards 25m/75m, five for 50m. Fixed program data, not work RAM.
const STEP_TABLE_ODD = 0x1623; // 25m / 75m
const STEP_TABLE_50M = 0x1637; // 50m

// Dispatch-site labels handed to the computed-jump dispatcher; they only ever surface inside
// a NotImplemented throw, naming which inline table an out-of-range selector fell off of.
const DISPATCH_TABLE_1623 = "0x1623 (0x6388 board sub-dispatch)";
const DISPATCH_TABLE_1637 = "0x1637 (0x6388 board sub-dispatch)";

// Vector the board-render sequence step through a table of little-endian targets. The step
// index is doubled to a byte offset with the hardware's 8-bit wrap (the offset wraps at 256),
// the target word is read at that offset, and the generic dispatcher jumps to it.
function dispatchBoardRenderStep(m, tableBase, site) {
  const { mem } = m;
  const step = mem.read8(BOARD_ADVANCE_STEP);
  const entry = (tableBase + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  loc_00ca(m, target, site);
}

export function dispatchBoardClearedInterlude(m) {
  const { mem } = m;

  // Park the moving sprite groups off-screen before the board-render sequence runs.
  clearSpriteColumns(m);

  // Route by board type. The odd boards (25m/75m) and 50m each own a step table; 100m has neither
  // bit set and falls through to the rivet-board interlude frame.
  const board = mem.read8(BOARD);
  if ((board & 0x01) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_ODD, DISPATCH_TABLE_1623); // 25m / 75m
  } else if ((board & 0x02) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_50M, DISPATCH_TABLE_1637); // 50m
  } else {
    runRivetBoardInterludeFrame(m); // 100m
  }
}
