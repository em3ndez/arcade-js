// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelRight — the +X motion arm of the barrel walk: stage the two forward-step values the
 * shared roll tail consumes, advance this barrel's X by one, and run that tail.
 * WARNING: the register-bank swap is a CONTRACT — every motion arm works in the alternate bank and
 * the swap back at their convergence restores the walk's loop state; dropping it here corrupts those
 * live loop registers (the record pointer lives in the untouched index register).
 * LIVE-OUT: memory-only (OBJ_X + the two shadow values) plus the tail's return.
 */

import { advanceRollingBarrel } from "./advanceRollingBarrel.js";
import { OBJ_X } from "./names.js";

const GIRDER_SNAP_STEP = 1; // girder-snap step selector: snap on the offset-0 edge
const TAIL_SELECT_BITS = 0;

export function stepBarrelRight(m, record = m.regs.ix) {
  const { mem8 } = m;

  m.regs.exx(); // into the shadow set — see the contract above; the tail does not swap back

  // One pixel forward; the store truncates, so X 255 wraps to 0 as the hardware does.
  mem8[record + OBJ_X] = mem8[record + OBJ_X] + 1;

  // Both shadow values and the record pointer ride the return, bridge-set before the tail.
  return [m.regs.b = GIRDER_SNAP_STEP, m.regs.c = TAIL_SELECT_BITS, m.regs.ix = record, advanceRollingBarrel(m)];
}
