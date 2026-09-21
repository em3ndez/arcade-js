// SPDX-License-Identifier: GPL-3.0-only
/**
 * findHammerOverlappingMario — test whether Mario overlaps either of the two hammer objects, via
 * the shared object bounding-box search: Mario is the reference point (Y first axis, X second),
 * the records are the two-object hammer pair at the object stride, per-axis tolerances 8 and 4.
 * LIVE-OUT: registers only as the search leaves them — a hit/miss byte, and on a hit the record
 * count minus the matched index; the routine itself returns nothing.
 */

import { MARIO_ACTIVE, MARIO_Y, OBJ_PAIR_6680 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function findHammerOverlappingMario(m) {
  // The six values are register-bridge inputs to the search; the writes ride the return so they
  // persist for the search while the routine's shape stays void.
  // prettier-ignore
  return void (m.regs.iy = MARIO_ACTIVE, m.regs.c = m.mem8[MARIO_Y], m.regs.hl = 0x0408, m.regs.b = 0x02, m.regs.de = 16, m.regs.ix = OBJ_PAIR_6680, findCollidingObject(m));
}
