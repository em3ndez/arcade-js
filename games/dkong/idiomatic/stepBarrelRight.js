// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelRight — the +X motion arm of the barrel walk: stage the two forward-step values the
 * shared roll tail consumes, advance this barrel's X by one, and run that tail.
 * LIVE-OUT: memory-only (OBJ_X) plus the tail's return.
 */

import { advanceRollingBarrel } from "./advanceRollingBarrel.js";
import { OBJ_X } from "./names.js";

const GIRDER_SNAP_STEP = 1; // girder-snap step selector: snap on the offset-0 edge
const TAIL_SELECT_BITS = 0;

export function stepBarrelRight(m, cur, record = m.regs.ix) {
  const { mem8 } = m;

  // One pixel forward; the store truncates, so X 255 wraps to 0 as the hardware does.
  mem8[record + OBJ_X] = mem8[record + OBJ_X] + 1;

  // The slope selector and direction code ride the return into the shared tail.
  return [m.regs.b = GIRDER_SNAP_STEP, m.regs.c = TAIL_SELECT_BITS, advanceRollingBarrel(m, cur)];
}
