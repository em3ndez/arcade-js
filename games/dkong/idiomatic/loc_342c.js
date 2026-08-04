// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_342c — start or resume one object's scripted position walk, advance its X one step, then
 * hand to the shared table-walk tail.
 *
 * The head of one of the two object-animation walkers; its twin shares the same tail. Each call
 * drives the object whose record the caller points at through one step of a scripted path. THIS
 * routine owns the object's horizontal march and the walk's start-or-resume decision, while the
 * tail reads the next table entry into the object's Y and keeps the saved pointer.
 *
 *   • The saved 16-bit table pointer is reloaded from the object record. Zero means the walk
 *     has not started — or has just finished and been rewound — so this is a FRESH start: aim
 *     at the path table's beginning and stamp the object's starting X. Non-zero means the walk
 *     is already in progress, so the saved position is kept.
 *
 *   • Either way the object's X is then advanced one step this frame, so on a fresh start the
 *     first frame's X is the seed plus one and every later frame adds one more, marching the
 *     object sideways while the tail supplies its Y from the table.
 *
 *   • The resolved table pointer and the object record go to the shared tail, which reads the
 *     next entry: an ordinary entry becomes the object's Y and advances the saved pointer, and
 *     the end-of-table marker finalizes the walk — latching the final position and rewinding
 *     the pointer to zero, which is what makes the next call read as a fresh start here.
 *
 * The tail reads the object record and the walk pointer from registers, so the record pointer
 * is left in place and the resolved table pointer is loaded where the tail expects it.
 *
 * NOT CLAIMED: which object or cutscene this animates. The mechanism — start or resume a
 * scripted walk and march the X — is what is pinned.
 *
 * Reads: the object's saved walk pointer and its X. Writes: the object's X, and on a fresh
 * start the starting-X seed.
 *
 * LIVE-OUT: memory-only. The caller drives control flow and reads the object back through its
 * record on the next pass.
 */

import { OBJ_X, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "./names.js";
import { loc_3445 } from "./loc_3445.js";

// Address of the object's scripted Y-path table — the walk's starting point. It lives in
// program memory rather than work RAM, so it stays a bare constant.
const TABLE_START = 0x3a8c;
// The object's starting X, stamped on the first pass of a fresh walk.
const X_SEED = 38;

/**
 * @param {object} m  the machine (uses m.regs and m.mem).
 * @returns {void}
 */
export function loc_342c(m) {
  const { regs, mem } = m;

  // The object record the caller points at; the tail reads it from the same place.
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;

  // Reload the saved 16-bit table pointer (low, then high) from the object record.
  const saved = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);

  // A zero saved pointer means the walk has not started yet: aim at the table's start and
  // stamp the object's starting X. Otherwise resume from the saved position.
  let ptr;
  if (saved !== 0) {
    ptr = saved;
  } else {
    ptr = TABLE_START;
    mem.write8(field(OBJ_X), X_SEED);
  }

  // March the object's X one step this frame (its X advances while the tail supplies its Y).
  mem.write8(field(OBJ_X), mem.read8(field(OBJ_X)) + 1);

  // Hand the resolved table pointer to the shared tail (marshalled where it reads it), which
  // reads the next entry and either advances the walk or finalizes it at the end of the table.
  regs.hl = ptr;
  loc_3445(m);
}
