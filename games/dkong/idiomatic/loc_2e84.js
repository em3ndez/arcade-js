// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e84 — one state of the per-object update: step this object 3 along Y, retire it (clear
 * its X and active flag) once it reaches the travel limit, then mirror its position to its
 * sprite and advance both scan cursors. The record is at the object-scan cursor in regs.ix.
 *
 * LIVE-OUT: the object's Y always, its X and active flag on the retire path, the two sprite
 * position bytes the mirror writes, and the two cursors the mirror advances.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X, OBJ_Y } from "./names.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js";

const TRAVEL_LIMIT = 248;

export function loc_2e84(m) {
  const { regs, mem8 } = m;

  const newY = u8(mem8[regs.ix + OBJ_Y] + 3);
  mem8[regs.ix + OBJ_Y] = newY;

  if (newY >= TRAVEL_LIMIT) {
    mem8[regs.ix + OBJ_X] = 0;
    mem8[regs.ix + OBJ_ACTIVE] = 0;
  }

  mirrorObjectPositionToSprite(m);
}
