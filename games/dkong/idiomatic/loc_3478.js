// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3478 — start or continue one object's table-driven position walk, marching the object's X
 * in a chosen direction and leaving the per-frame Y to the shared tail.
 *
 * The forward/backward TWIN of the other object-animation walker head: both reload the object's
 * saved table pointer, test it for zero, and hand over to the same shared walk tail. Where the
 * twin uses one flat table with a plain step, this one keys a DIRECTION off a shared context
 * byte and can march the X index either up or down.
 *
 *   • FRESH walk (the saved table pointer is zero) — point the walk at this twin's own path
 *     table and choose a direction from bit 7 of the context byte. The bit set picks FORWARD,
 *     which stores direction mark 1 and seeds one X; the bit clear picks BACKWARD, which stores
 *     mark 2 and seeds another.
 *
 *   • CONTINUING walk (the saved table pointer is non-zero) — leave the direction and the table
 *     pointer as the previous pass left them and just resume.
 *
 * Either way the direction mark then steers the object's X index: FORWARD steps it up by one,
 * any other mark steps it down by one. Finally control passes to the shared tail with the table
 * pointer live; that tail stores the next table entry as the object's Y and advances the walk,
 * or finalizes it at the table's terminator. Its return is this routine's return, so there is
 * no separate exit here.
 *
 * NOT CLAIMED: which object or animation this drives, and why bit 7 of that context byte means
 * "direction" — only that it selects one of the two arms.
 *
 * Reads: the object's saved walk pointer, its direction mark and its X; bit 7 of the shared
 * context byte. Writes: the object's X always, and on a fresh walk its direction mark and the
 * X seed.
 *
 * LIVE-OUT: memory-only. The object is read back through its record on the next pass; the one
 * live register hand-off is the table pointer the shared tail reads.
 */

import { loc_3445 } from "./loc_3445.js";
import { OBJ_X, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI, MARIO_X } from "./names.js";

// This twin's own path table. It lives in program memory rather than work RAM, so it stays a
// bare constant.
const PATH_TABLE = 0x3aac;

// bit 7 of the shared context byte (MARIO_X) selects the walk direction (meaning uninterpreted).
const DIRECTION_BIT = 0x80;

// Direction marks stored in OBJ_STATE, and the matching fresh-walk X seed for each.
const DIR_FORWARD = 0x01;
const DIR_BACKWARD = 0x02;
const FORWARD_SEED = 0x7e;
const BACKWARD_SEED = 0x80;

/**
 * @param {object} m  the machine (uses m.regs and m.mem).
 * @returns {void}
 */
export function loc_3478(m) {
  const { regs, mem } = m;

  // The object record the caller points at, unchanged throughout.
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;

  // Reload the object's saved table pointer (low, high).
  let ptr = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);

  if (ptr === 0) {
    // Fresh walk: aim at this twin's path table and pick a direction from bit 7 of the
    // shared context byte.
    ptr = PATH_TABLE;
    if ((mem.read8(MARIO_X) & DIRECTION_BIT) === 0) {
      mem.write8(field(OBJ_STATE), DIR_BACKWARD);
      mem.write8(field(OBJ_X), BACKWARD_SEED);
    } else {
      mem.write8(field(OBJ_STATE), DIR_FORWARD);
      mem.write8(field(OBJ_X), FORWARD_SEED);
    }
  }

  // Direction dispatch: FORWARD steps the X index up, any other mark steps it down.
  if (mem.read8(field(OBJ_STATE)) === DIR_FORWARD) {
    mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) + 1) & 0xff);
  } else {
    mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) - 1) & 0xff);
  }

  // Hand over to the shared walk tail with the table pointer live; it reads that and the
  // record pointer. Its return is this routine's return.
  regs.hl = ptr;
  loc_3445(m);
}
