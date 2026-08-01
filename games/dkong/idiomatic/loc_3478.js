// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3478 — start-or-continue one object's table-driven position walk, marching the
 * object's X in a chosen direction and deferring the per-frame Y to the shared tail.
 * ROM 0x3478.
 *
 * The forward/backward TWIN of sub_342c: both reload the object's saved table pointer,
 * test it for zero, and hand over to the shared walk tail loc_3445 (0x3445) — but where
 * sub_342c uses one flat table with a plain step, this routine keys a DIRECTION off the
 * object's context and can march the X index either up or down.
 *
 *   • FRESH walk (the saved table pointer is zero) — point the walk at THIS twin's own
 *     path table and choose a direction from bit 7 of the shared context byte (0x6203):
 *     bit set picks FORWARD (direction mark 1, X seeded to 0x7E), bit clear picks BACKWARD
 *     (direction mark 2, X seeded to 0x80). The direction meaning of that bit is not
 *     interpreted here — only that it selects one of the two arms.
 *
 *   • CONTINUING walk (the saved table pointer is non-zero) — leave the direction and the
 *     table pointer as the previous pass left them and just resume.
 *
 * Either way the direction mark then steers the object's X index: FORWARD steps it up by
 * one, any other mark steps it down by one. Finally the routine tails into loc_3445 with
 * the table pointer live, which stores the next table entry as the object's Y and advances
 * (or, at the table's terminator, finalizes) the walk — loc_3445's return is this routine's
 * return, so there is no separate exit here.
 *
 * NOT YET LIVE: reached only from the still-translated sub_32bd (0x32D2), so it is never
 * dispatched during boot/attract — the gate is crafted/exhaustive, not captured.
 *
 * NAME: kept the neutral loc_ — the mechanism (a direction-selected table-driven X walk
 * sharing sub_342c's finalize tail) is pinned to the oracle, but which object/animation
 * this drives, and why bit 7 of that context byte means "direction", are not corroborated
 * to the naming bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3478.test.js.
 * GATE:     strict memory-equivalence, crafted-exhaustive (0x3478 is never dispatched, so
 *           there are no real captures): the direction select over every context-byte value,
 *           the direction dispatch over every direction-mark value, the X step over every X
 *           value on both arms (the 8-bit up/down wrap), and the pointer hand-off over every
 *           table byte (ordinary vs the terminator) and pointer low byte. Whole-dump RAM diff
 *           — the routine pushes nothing, and loc_3445's terminal return only POPS, so no
 *           STACK_SCRATCH exclusion is needed. Teeth: a wrong direction bit, a swapped
 *           dispatch, a dropped table-pointer hand-off, and a dropped zero test.
 * LIVE-OUT: memory-only — the object is read back through its record on the next pass; the
 *           oracle's residual registers/flags and its (loc_3445-borrowed) terminal return
 *           are dead ABI. The one live register hand-off is the table pointer loc_3445 reads.
 * NAMES:    OBJ_X (record +0x03), OBJ_STATE (+0x0d), OBJ_WALK_PTR_LO (+0x1a),
 *           OBJ_WALK_PTR_HI (+0x1b) — from ram.js (the OBJ_ARRAY_64 record) — and MARIO_X
 *           (0x6203), read only for its bit 7 as the direction selector. The path-table base
 *           (0x3AAC) is in ROM, not work RAM, so it stays a local const.
 */

import { loc_3445 } from "./loc_3445.js"; // ROM 0x3445 — the shared table-walk + finalize tail
import { OBJ_X, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI, MARIO_X } from "./ram.js";

// This twin's own path table in ROM (sub_342c uses 0x3A8C). Not work RAM -> stays a const.
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

  // The object record the caller points at (an oracle boundary: it arrives in a register
  // because sub_32bd is still the oracle; unchanged throughout).
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

  // Tail into the shared walk tail with the table pointer live (loc_3445 reads it and the
  // record pointer). Its return is this routine's return.
  regs.hl = ptr;
  loc_3445(m);
}
