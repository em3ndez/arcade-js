// SPDX-License-Identifier: GPL-3.0-only
import { ROPE_CELL_DISPATCH } from "./names.js";
/**
 * dispatchRopeCellState — per-rope-cell dispatcher.
 *
 * An inactive cell (state 0) returns at once. Otherwise the cell's state-1 selects one of four
 * rope-cell handlers via the inline table ROPE_CELL_DISPATCH, returning straight to our caller.
 *
 * LIVE-OUT: none — a void dispatcher; every effect lands in the cell record the handler touches.
 */
export function dispatchRopeCellState(m, rec = m.regs.ix) {
  const state = m.mem8[rec];
  if (state === 0) return; // inactive cell

  m.regs.ix = rec; // bridge: the rst-28 handlers read the cell record from IX
  m.regs.a = (state - 1) & 0xff;
  m.push16(ROPE_CELL_DISPATCH); // inline jump-table base the trampoline pops
  return m.call(0x0028); // rst-28 dispatcher -> handler -> our caller
}
