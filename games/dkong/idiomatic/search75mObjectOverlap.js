// SPDX-License-Identifier: GPL-3.0-only
/**
 * search75mObjectOverlap — the 75m (board 3) arm of the board-overlap-search dispatch: recover the
 * pushed per-axis tolerances, then run the shared bounding-box collision search over two object
 * arrays in turn, stopping at the first hit.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT, plus the search result the dispatch caller consumes (the tolerance
 * word, stride and array base ride each exit's return so they persist).
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 5;
const SWEEP1_STRIDE = 0x20;
const SWEEP2_COUNT = 10;
const SWEEP2_STRIDE = 0x10;

export function search75mObjectOverlap(m) {
  const { regs, mem8 } = m;

  // Tolerances the dispatcher pushed: low byte = axis-1 window, high byte = axis-2 window.
  const bounds = m.pop16();
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  // Sweep 1: a hit takes the search's caller-skip return, unwinding past this routine, so sweep 2
  // never runs and OBJ_SEARCH_COUNT stays at this count.
  mem8[OBJ_SEARCH_COUNT] = SWEEP1_COUNT;
  // prettier-ignore
  if (!findCollidingObject(m, OBJ_ARRAY_64, undefined, tolLow, undefined, tolHigh, SWEEP1_STRIDE, SWEEP1_COUNT)) return (regs.hl = bounds, regs.de = SWEEP1_STRIDE, regs.ix = OBJ_ARRAY_64, true);

  // Sweep 2: reached only when sweep 1 found nothing.
  mem8[OBJ_SEARCH_COUNT] = SWEEP2_COUNT;
  findCollidingObject(m, OBJ_ARRAY_65, undefined, tolLow, undefined, tolHigh, SWEEP2_STRIDE, SWEEP2_COUNT);
  return (regs.hl = bounds, regs.de = SWEEP2_STRIDE, regs.ix = OBJ_ARRAY_65, true);
}
