// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3445 — advance one object's table-driven position walk, or finalize it at the end of
 * the table.
 *
 * The shared tail of two object-animation walkers. Each hands over an object-record pointer
 * and a saved table pointer, and this tail reads the next table entry and does one of two
 * things:
 *
 *   • ORDINARY entry — the entry byte becomes the object's Y for this frame, then the saved
 *     table pointer is stepped one byte forward and written back, low byte then high, so the
 *     next pass resumes where this one left off. The caller separately advances the object's
 *     X, so the object tracks the table's Y values as its X marches on.
 *
 *   • TERMINATOR — the table is exhausted and the walk is finished: four per-object
 *     animation-state bytes are cleared, the object's final X and Y are latched into two
 *     record fields, and the saved table pointer is rewound to zero, which is what makes the
 *     caller read the next pass as a fresh start.
 *
 * The record pointer arrives in a register because the callers hand it over that way.
 *
 * NOT CLAIMED: which object or cutscene this animates, and what the walk's own bookkeeping
 * fields are for beyond their role here.
 *
 * Reads: the table entry at the saved walk pointer; on the terminator arm, the object's
 * current X and Y. Writes: on an ordinary entry, the object's Y and the two saved-pointer
 * bytes; on the terminator, four state bytes, the two final-position latches, and the rewound
 * pointer.
 *
 * LIVE-OUT: memory-only. The callers drive control flow through this tail and read the object
 * back through its record on the next pass.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "./names.js";

// End-of-table marker in the path table the walk reads.
const TABLE_TERMINATOR = 0xaa;

// Object-record fields that carry no shared name, scoped here and named for the role they
// play in this walk.
const FINAL_X = 0x0e; // object's final X, latched when the walk completes
const FINAL_Y = 0x0f; // object's final Y, latched when the walk completes
const WALK_FLAG_A = 0x13; // per-object animation-state bytes cleared on completion —
const WALK_FLAG_B = 0x18; //   what each one separately controls is not established
const WALK_FLAG_C = 0x1c;

/**
 * @param {object} m  the machine (uses m.regs and m.mem).
 * @returns {void}
 */
export function loc_3445(m) {
  const { regs, mem } = m;

  // The object record the caller points at.
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;

  // Read the next table entry through the saved walk pointer.
  const entry = mem.read8(regs.hl);

  if (entry === TABLE_TERMINATOR) {
    // End of the table — finish the walk: clear the animation-state bytes, latch the
    // object's current X/Y as its final position, and rewind the saved pointer to zero.
    mem.write8(field(WALK_FLAG_A), 0);
    mem.write8(field(WALK_FLAG_B), 0);
    mem.write8(field(OBJ_STATE), 0);
    mem.write8(field(WALK_FLAG_C), 0);
    mem.write8(field(FINAL_X), mem.read8(field(OBJ_X)));
    mem.write8(field(FINAL_Y), mem.read8(field(OBJ_Y)));
    mem.write8(field(OBJ_WALK_PTR_LO), 0);
    mem.write8(field(OBJ_WALK_PTR_HI), 0);
    return;
  }

  // Ordinary entry: it becomes the object's Y for this frame.
  mem.write8(field(OBJ_Y), entry);

  // Step the saved table pointer one byte forward and store it back, low then high.
  const next = u16(regs.hl + 1);
  mem.write8(field(OBJ_WALK_PTR_LO), next); // low byte (the store truncates to 8 bits)
  mem.write8(field(OBJ_WALK_PTR_HI), next >> 8); // high byte
}
