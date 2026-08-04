// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveAirborneTileLanding — resolve whether Mario's airborne descent has reached a
 * tile surface; on a hit, snap him onto it and abort the collision probe.
 *
 * The tail of the tile classifier: it is entered once the classifier has built the
 * tile-column surface boundary. It measures how far Mario has descended by comparing a
 * probe value against that boundary:
 *
 *     probe = MARIO_AIR_PREV_Y - (object Y field) + rowOffset
 *
 * where the previous-frame airborne Y comes from MARIO_AIR_PREV_Y, the object's
 * current Y is the record field at +5 of the caller's object pointer (in the Mario
 * collision case that pointer is the Mario block, so +5 aliases MARIO_Y), and
 * rowOffset is the tile-row adjustment the classifier passes in.
 *
 *   - probe ABOVE the boundary: Mario is still clear of this tile. Report the "still
 *     airborne, keep probing" code (2) and return normally, so the collision walk continues.
 *
 *   - probe AT OR BELOW the boundary: Mario has reached the surface. Snap MARIO_Y to just
 *     above the boundary (boundary − 7), report the "landed" code (1), and take the
 *     two-frame unwind — the landing aborts the whole multi-probe walk, not just this
 *     classifier call. That unwind is expressed as returning `false` under the caller-skip
 *     convention, which the classifier propagates and its own caller completes.
 *
 * Register live-ins come from the caller: the boundary, the row offset, and the object
 * pointer. The result code is left where the caller reads it, with its twin in the secondary
 * result byte, on both arms.
 *
 * LIVE-OUT: MARIO_Y on the at-or-below arm; the result code (2 = airborne, 1 = landed) and
 * its twin; and the caller-skip boolean, where false is the two-frame unwind. No stack is
 * written.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_AIR_PREV_Y, MARIO_Y } from "./names.js";

/**
 * @param {object} m  the machine. Live-in registers: the object pointer, the column
 *   boundary, and the row offset; live-out registers: the result code and its twin.
 * @returns {boolean} true = normal return (still airborne); false = the two-frame
 *   unwind of the caller-skip convention (landed — the collision walk aborts).
 */
export function resolveAirborneTileLanding(m) {
  const { regs, mem } = m;

  const boundary = regs.c;
  const objectY = mem.read8((regs.ix + 5) & 0xffff); // object record field +5 (Mario: MARIO_Y)
  const probe = u8(mem.read8(MARIO_AIR_PREV_Y) - objectY + regs.e);

  if (probe > boundary) {
    // Still clear of this tile — report "airborne" and let the walk continue.
    regs.a = 2;
    regs.b = 0;
    return true;
  }

  // Reached the surface — snap Mario onto it and abort the whole probe walk.
  mem.write8(MARIO_Y, boundary - 7);
  regs.a = 1;
  regs.b = 1;
  return false;
}
