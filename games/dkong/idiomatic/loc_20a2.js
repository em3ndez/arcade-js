// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20a2 — on the first frame an airborne object's fall is arrested, decide whether the object
 *            also turns round, then hand its record on to the tail that bounces it.
 *
 * Three bytes are read and none is written here: the record's kind index, the record's OBJ_Y, and
 * MARIO_Y. Both exits are jumps, so everything that actually happens to the object happens below
 * this routine:
 *   turn arm    — give the record a horizontal step of exactly one whole pixel per frame, in the
 *                 direction OPPOSITE to the one it is carrying, and continue into the bounce.
 *   bounce tail — replace the record's launch speed, restart its arc counter and clear the two
 *                 position fractions, so the arc starts again going the other way.
 * The whole decision made here is whether the object turns round. It bounces on every arm.
 *
 * THE ARMS. An object of the alternate kind turns round unconditionally. An object of the default
 * kind turns round too, UNLESS it has come to rest well below Mario — 22 rows or more — in which
 * case it is left carrying on the way it was going.
 *
 * WHAT THIS DOES NOT CLAIM. Why an object well below Mario is left alone: what that arm is FOR,
 * and whether the clearance means anything beyond "not on this row", is not established here. Nor
 * does anything here say the kind index's values are the two barrel kinds — this routine only
 * separates zero from non-zero.
 *
 * AN EDGE IN THE ARITHMETIC. The clearance is taken off OBJ_Y as a BYTE, so an object within 22
 * rows of the top of the screen wraps to a large value and takes the no-turn arm regardless of
 * where Mario is.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the machine's record pointer rather
 * than becoming a named argument, because both tails re-read that pointer to reach the rest of
 * the same record. A caller passing a different record would be obeyed by the three reads here
 * and ignored one call later.
 *
 * LIVE-OUT: memory, plus the propagated return value — and nothing of this routine's own. It
 * writes no register and no flag; every register visible at the exit belongs to the tail that
 * runs after it.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, OBJ_Y } from "./names.js";

/**
 * The object record's kind index. Zero and non-zero are the only distinction drawn here, and the
 * registry names the cell a claim's kind bit is set in, not this per-record copy, so the offset
 * stays file-local.
 */
const OBJ_KIND = 0x15;

/** How far below Mario the object must have come to rest for the turn to be skipped, in pixels. */
const CLEARANCE_BELOW_MARIO = 22;

export function loc_20a2(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  const at = (offset) => (record + offset) & 0xffff;

  // An object of the alternate kind turns round without being asked where Mario is.
  if (mem8[at(OBJ_KIND)] !== 0) return m.call(0x20b5);

  // Otherwise it keeps going the way it was only if it has come to rest well below him. The
  // subtraction is a byte, so an object near the top of the screen wraps past every Mario position
  // and lands on this arm too.
  if (u8(mem8[at(OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[MARIO_Y]) return m.call(0x20c3);

  return m.call(0x20b5);
}
