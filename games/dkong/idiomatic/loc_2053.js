// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2053 — arc-travel branch of the OBJ_ARRAY_67 object sweep: carry one record a frame further
 * along its ballistic arc, then route on what that step ran it into.
 *
 * ORDER IS LOAD-BEARING: the girder probe and the retire test both read the position the arc step
 * has already written. Retire fires on an OBJ_X window of 248..255 / 0..7 (walk-to-zero and
 * wrap-past-zero in one compare) and clears OBJ_ACTIVE, taking the record out of the sweep.
 *
 * Every arm returns undefined; which arm control leaves through is the observable. The staging
 * cursor `cur` is threaded to the shared sprite tail.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { retireBarrelIntoOilDrum } from "./retireBarrelIntoOilDrum.js";
import { u8 } from "../../../core/int.js";
import { OBJ_X } from "./names.js";
import { stepBallisticMotion } from "./stepBallisticMotion.js";
import { loc_2a2f } from "./loc_2a2f.js";
import { advanceBarrelSpriteOrientation } from "./advanceBarrelSpriteOrientation.js";
import { loc_2083 } from "./loc_2083.js";
import { loc_2079 } from "./loc_2079.js";

const OBJ_VELOCITY_X_HI = 0x10;
const RETIRE_MARGIN = 8;

export function loc_2053(m, cur, record = m.regs.ix) {
  const { mem8 } = m;

  stepBallisticMotion(m);

  // Landed on a girder: the girder sub-state machine takes over and runs the tail itself.
  if (loc_2a2f(m)) return loc_2083(m, cur);

  // Reached the edge: clear the active flag to drop the record from the sweep.
  if (u8(mem8[record + OBJ_X] + RETIRE_MARGIN) < 2 * RETIRE_MARGIN) return loc_2079(m, cur);

  // Bounds gate; it splices past this routine, so its answer gates everything below.
  if (!retireBarrelIntoOilDrum(m, cur)) return;

  advanceBarrelSpriteOrientation(m, record, (mem8[record + OBJ_VELOCITY_X_HI] & 1) * 4);

  return publishBarrelSprite(m, cur);
}
