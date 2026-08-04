// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleFireOnGirderSlope — on the girder board only, settle a fire's height onto the slope of the
 * girder it is standing on, by advancing its stepped coordinate a single girder step.
 *
 * A short tail: the walk step has no return of its own and FALLS THROUGH into this body, and the
 * turn path calls it. Guarded on BOARD being the girder board, it re-steps one coordinate of the
 * fire the caller pointed at. It reads the companion coordinate, the coordinate to step and
 * OBJ_STATE, hands them to the girder-slope single-step, and stores the stepped result back into
 * the same field. On any other board it does nothing at all — the caller's field work still
 * happens, but this step is gated.
 *
 * The record pointer arrives from the caller in a register rather than as a promoted parameter,
 * because both entries hand the record over that way.
 *
 * LIVE-OUT: memory only — the single stored coordinate. The board-guard early-out is this
 * routine's whole other arm.
 */

import { BOARD, OBJ_STATE } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js"; // girder-slope single-step (pure)

// Fire-record fields addressed off the record pointer; neither carries a registered offset name.
// The companion coordinate's low nibble is the sub-cell position; the other is the one stepped and
// then stored back.
const OBJ_COMPANION_COORD = 0x0e;
const OBJ_STEPPED_COORD = 0x0f;

const BOARD_GIRDER = 0x01; // this tail runs only on the girder board

export function settleFireOnGirderSlope(m) {
  const { regs, mem } = m;

  // Girder board only — on any other board this returns without touching RAM.
  if (mem.read8(BOARD) !== BOARD_GIRDER) return;

  // The fire-record pointer the caller supplied.
  const objBase = regs.ix;

  const companion = mem.read8((objBase + OBJ_COMPANION_COORD) & 0xffff);
  const coord = mem.read8((objBase + OBJ_STEPPED_COORD) & 0xffff);
  const state = mem.read8((objBase + OBJ_STATE) & 0xffff);

  // Advance the coordinate by one girder step (or hold on a non-boundary frame), then store
  // the result back into the same field.
  mem.write8((objBase + OBJ_STEPPED_COORD) & 0xffff, snapYToGirder(companion, coord, state));
}
