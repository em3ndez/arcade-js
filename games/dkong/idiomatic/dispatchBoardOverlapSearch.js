// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardOverlapSearch — vector to the current board's object-overlap arm, selecting by BOARD
 * (1=25m overlap counter, 2=50m, 3=75m, 4=100m; other values are the never-reached reset-vector
 * guards). The probe point (iy/c) and per-axis tolerance word (bounds) are handed to the arm; the
 * arm's severity code is returned to the caller.
 */

import {
  BOARD,
} from "./names.js";
import { loc_3e99 } from "./loc_3e99.js";
import { search50mObjectOverlap } from "./search50mObjectOverlap.js";
import { search75mObjectOverlap } from "./search75mObjectOverlap.js";
import { search100mObjectOverlap } from "./search100mObjectOverlap.js";

export const OVERLAP_HANDLERS = {
  1: loc_3e99,
  2: search50mObjectOverlap,
  3: search75mObjectOverlap,
  4: search100mObjectOverlap,
};

export function dispatchBoardOverlapSearch(m, { iy, c, bounds }) {
  const handler = OVERLAP_HANDLERS[m.mem8[BOARD]];
  if (!handler) throw new Error(`dispatchBoardOverlapSearch: no overlap arm for board ${m.mem8[BOARD]}`);
  return handler(m, { iy, c, bounds }).overlap;
}
