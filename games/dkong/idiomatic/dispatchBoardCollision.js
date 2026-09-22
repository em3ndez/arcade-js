// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardCollision — vector a collision test to the current board's handler, selecting the arm
 * by BOARD (1=25m, 2=50m, 3=75m, 4=100m; other values are the never-reached reset-vector guards).
 * The reference point (iy/c) and per-axis tolerance word (bounds) are handed straight to the arm,
 * whose search outcome { overlap, residue, stride, base } is returned to the caller.
 */

import {
  BOARD,
} from "./names.js";
import { search25mObjectOverlap } from "./search25mObjectOverlap.js";
import { search50mObjectOverlap } from "./search50mObjectOverlap.js";
import { search75mObjectOverlap } from "./search75mObjectOverlap.js";
import { search100mObjectOverlap } from "./search100mObjectOverlap.js";

export const COLLISION_HANDLERS = {
  1: search25mObjectOverlap,
  2: search50mObjectOverlap,
  3: search75mObjectOverlap,
  4: search100mObjectOverlap,
};

export function dispatchBoardCollision(m, { iy, c, bounds }) {
  const handler = COLLISION_HANDLERS[m.mem8[BOARD]];
  if (!handler) throw new Error(`dispatchBoardCollision: no collision arm for board ${m.mem8[BOARD]}`);
  return handler(m, { iy, c, bounds });
}
