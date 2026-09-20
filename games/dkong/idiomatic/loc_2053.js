// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2053 — arc-travel branch of the OBJ_ARRAY_67 object sweep: carry one record a frame further
 * along its ballistic arc, then route on what that step ran it into.
 *
 * ORDER IS LOAD-BEARING: the girder probe and the retire test both read the position the arc step
 * has already written. Retire fires on an OBJ_X window of 248..255 / 0..7 (walk-to-zero and
 * wrap-past-zero in one compare) and clears OBJ_ACTIVE, taking the record out of the sweep.
 *
 * THE REGISTER-SET SWAP IS A CONTRACT: this branch swaps to the shadow set on entry and reaches the
 * shared sprite tail WITHOUT swapping back — the tail's own swap restores the sweep's loop state, so
 * dropping the swap here corrupts those live loop registers. Every arm returns undefined; which arm
 * control leaves through is the observable.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { u8 } from "../../../core/int.js";
import { OBJ_X } from "./names.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { loc_2a2f } from "./loc_2a2f.js";
import { advanceBarrelSpriteOrientation } from "./advanceBarrelSpriteOrientation.js";

const OBJ_VELOCITY_X_HI = 0x10;
const RETIRE_MARGIN = 8;

export function loc_2053(m, record = m.regs.ix,) {
  const { regs, mem8 } = m;

  // Into the shadow set; the shared tail swaps back.
  regs.exx();

  // Publish the record; callees read it from the index register, not as an argument.
  regs.ix = record;

  stepBallisticMotion(m);

  // Landed on a girder: the girder sub-state machine takes over and runs the tail itself.
  if (loc_2a2f(m)) return m.call(0x2083);

  // Reached the edge: clear the active flag to drop the record from the sweep.
  if (u8(mem8[record + OBJ_X] + RETIRE_MARGIN) < 2 * RETIRE_MARGIN) return m.call(0x2079);

  // Bounds gate; it splices past this routine, so its answer gates everything below.
  m.push16(0x206b);
  if (!m.call(0x24b4)) return;

  advanceBarrelSpriteOrientation(m, record, (mem8[record + OBJ_VELOCITY_X_HI] & 1) * 4);

  return publishBarrelSprite(m);
}
