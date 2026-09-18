// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelRight — the +X motion arm of the barrel walk: stage the two forward-step values the
 * shared roll tail consumes, advance this barrel's X by one, and run that tail.
 * WARNING: the register-bank swap is a CONTRACT. Every motion arm works in the alternate bank and
 * none swaps back; the swap back at the arms' convergence restores the walk's loop state (cursor,
 * stride, count). Dropping it here lets the tail's scratch corrupt those live loop registers; the
 * record pointer lives in the untouched index register, so the tail still addresses the record.
 * The two staged values feed the girder snap (1 = snap on the offset-0 edge) and a packed sprite-
 * orientation lookup (0 here). LIVE-OUT: memory-only, OBJ_X and the two shadow values, plus the
 * tail's return propagated unchanged.
 */

import { OBJ_X } from "./names.js";

const GIRDER_SNAP_STEP = 1; // girder-snap step selector: snap on the offset-0 edge
const TAIL_SELECT_BITS = 0;

export function stepBarrelRight(
  m,
  record = m.regs.ix /* default: the motion dispatch leaves the record base here */,
) {
  const { regs, mem8 } = m;

  regs.exx(); // into the shadow set — see the contract above; the tail does not swap back
  regs.b = GIRDER_SNAP_STEP;
  regs.c = TAIL_SELECT_BITS;

  // One pixel forward; the store truncates, so X 255 wraps to 0 as the hardware does.
  mem8[record + OBJ_X] = mem8[record + OBJ_X] + 1;

  regs.ix = record;
  return m.call(0x1ff6);
}
