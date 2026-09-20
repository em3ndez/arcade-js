// SPDX-License-Identifier: GPL-3.0-only
/**
 * findHammerOverlappingMario — test whether Mario overlaps either of the two hammer objects and
 * report which one, via the shared object-list bounding-box search. Reference point is Mario
 * (his Y as the first axis, his X as the second); the records are the two-object hammer pair at
 * the object-record stride; per-axis base tolerances are 8 (first axis) and 4 (second). Stops at
 * the first active record whose box overlaps on both axes.
 *
 * LIVE-OUT: registers only, as the search leaves them — a hit/miss byte, and on a hit the record
 * count minus the matched index. This routine itself returns nothing.
 */

import { MARIO_ACTIVE, MARIO_Y, OBJ_PAIR_6680 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function findHammerOverlappingMario(m) {
  const { regs, mem8 } = m;

  regs.iy = MARIO_ACTIVE; // base of Mario's live block: the search reads his X for the second axis
  regs.c = mem8[MARIO_Y]; // Mario's Y = the first-axis reference point
  regs.hl = 0x0408; // per-axis base tolerances: 8 first axis, 4 second

  regs.b = 0x02;
  regs.de = 0x0010;
  regs.ix = OBJ_PAIR_6680;

  findCollidingObject(m);
}
