// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3478 — start or continue one object's table-driven position walk, marching the object's X
 * in a chosen direction and leaving the per-frame Y to the shared tail. On a fresh walk (saved
 * table pointer zero) it aims at this walker's path table and picks a direction from bit 7 of the
 * context byte; a continuing walk resumes as left. The direction mark then steps X up (forward)
 * or down, and control passes to the shared walk tail with the table pointer live; that tail's
 * return is this routine's return.
 *
 * LIVE-OUT: memory-only. The one live register hand-off is the table pointer the shared tail reads.
 */

import { loc_3445 } from "./loc_3445.js";
import {
  MARIO_X,
  OBJ_STATE,
  OBJ_WALK_PTR_HI,
  OBJ_WALK_PTR_LO,
  OBJ_X,
  WALK_PATH_TABLE_3478,
} from "./names.js";


const DIRECTION_BIT = 0x80; // bit 7 of the context byte (MARIO_X) selects the walk direction

const DIR_FORWARD = 0x01;
const DIR_BACKWARD = 0x02;
const FORWARD_SEED = 0x7e;
const BACKWARD_SEED = 0x80;

export function loc_3478(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const base = ix;
  const field = (off) => (base + off) & 0xffff;

  let ptr = mem8[field(OBJ_WALK_PTR_LO)] | (mem8[field(OBJ_WALK_PTR_HI)] << 8);

  if (ptr === 0) {
    ptr = WALK_PATH_TABLE_3478;
    if ((mem8[MARIO_X] & DIRECTION_BIT) === 0) {
      mem8[field(OBJ_STATE)] = DIR_BACKWARD;
      mem8[field(OBJ_X)] = BACKWARD_SEED;
    } else {
      mem8[field(OBJ_STATE)] = DIR_FORWARD;
      mem8[field(OBJ_X)] = FORWARD_SEED;
    }
  }

  if (mem8[field(OBJ_STATE)] === DIR_FORWARD) {
    mem8[field(OBJ_X)] = (mem8[field(OBJ_X)] + 1);
  } else {
    mem8[field(OBJ_X)] = (mem8[field(OBJ_X)] - 1);
  }

  // Hand over to the shared walk tail with the table pointer.
  loc_3445(m, m.regs.ix, ptr);
}
