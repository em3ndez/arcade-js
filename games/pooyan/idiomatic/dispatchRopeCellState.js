// SPDX-License-Identifier: GPL-3.0-only
import { spawnHangingRopeObject } from "./spawnHangingRopeObject.js";
import { advanceHangingRopeObject } from "./advanceHangingRopeObject.js";
import { advanceHangingRopeObjectWithGrabCheck } from "./advanceHangingRopeObjectWithGrabCheck.js";
import { retractRopeSegment } from "./retractRopeSegment.js";

/**
 * dispatchRopeCellState — per-rope-cell dispatcher.
 *
 * An inactive cell (state 0) returns at once. Otherwise the cell's state-1 selects one of four
 * rope-cell handlers, each acting on the cell record; the handler returns straight to our caller.
 *
 * LIVE-OUT: none — a void dispatcher; every effect lands in the cell record the handler touches.
 */
export function dispatchRopeCellState(m, rec = m.regs.ix) {
  const state = m.mem8[rec];
  if (state === 0) return; // inactive cell
  switch ((state - 1) & 0xff) {
    case 0: return spawnHangingRopeObject(m, rec);
    case 1: return advanceHangingRopeObject(m, rec);
    case 2: return advanceHangingRopeObjectWithGrabCheck(m, rec);
    case 3: return retractRopeSegment(m, rec);
  }
}
