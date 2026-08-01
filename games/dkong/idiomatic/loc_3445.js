// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3445 — advance one object's table-driven position walk, or finalize it at the
 * end of the table.  ROM 0x3445.
 *
 * The shared tail of two object-animation walkers (sub_342c and sub_3478, both still
 * the frozen oracle): sub_342c falls through into it, and sub_3478 tail-jumps to it
 * from two sites — so this block's return is those routines' return. Both hand over an
 * object-record pointer and a saved table pointer, then this tail reads the next table
 * entry and does one of two things:
 *
 *   • ORDINARY entry — the entry byte becomes the object's Y for this frame, then the
 *     saved table pointer is stepped one byte forward and written back (low then high)
 *     so the next pass resumes where this one left off. The caller separately advances
 *     the object's X, so the object tracks the table's Y values as its X marches on.
 *
 *   • TERMINATOR (the entry is 0xAA) — the table is exhausted, so the walk is finished:
 *     four per-object animation-state bytes are cleared, the object's final X and Y are
 *     latched into two record fields, and the saved table pointer is rewound to zero so
 *     the caller treats the next pass as a fresh start of the walk.
 *
 * The record pointer arrives in a register because the callers are still the oracle
 * (an oracle boundary), so this reads it from the machine rather than as a promoted
 * parameter; that dissolves once the callers are decompiled. The observed record is
 * object #0 of OBJ_ARRAY_64, so +0x03/+0x05/+0x0d are the named OBJ_X/OBJ_Y/OBJ_STATE.
 *
 * NAME: kept the neutral loc_ — the mechanism (a table-driven position walk with an
 * end-of-table finalize) is pinned to the oracle, but which object/cutscene this
 * animates, and the roles of the walk's own bookkeeping fields, are not yet corroborated
 * to the naming bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3445.test.js.
 * GATE:     strict memory-equivalence; factored-exhaustive — the terminator arm over the
 *           full OBJ_X×OBJ_Y grid (both latched copies + the constant clears), the
 *           ordinary arm's entry copy over every non-terminator byte, and the pointer
 *           step over every low-byte value including the carry into the high byte — plus
 *           the 32 real captured 0x3445 attract dispatches (31 ordinary, 1 terminator).
 *           Teeth: a wrong entry-store offset, a dropped pointer advance, swapped
 *           finalize copies, and a never-terminate twin.
 * LIVE-OUT: memory-only — the callers drive control flow through this tail and read the
 *           object back through its record on the next pass (the saved pointer is
 *           reloaded from +0x1a/+0x1b); the oracle's residual registers/flags and its
 *           terminal return are dead.
 * NAMES:    OBJ_X (record +0x03), OBJ_Y (record +0x05), OBJ_STATE (record +0x0d) — all
 *           from ram.js (the OBJ_ARRAY_64 record). The walk's own fields — the two latch
 *           targets (+0x0e/+0x0f), the saved-pointer bytes (+0x1a/+0x1b), and the three
 *           other cleared state bytes (+0x13/+0x18/+0x1c) — have no ram.js offset name yet
 *           and stay local consts here.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y, OBJ_STATE } from "./ram.js";

// End-of-table marker in the path table the walk reads.
const TABLE_TERMINATOR = 0xaa;

// Object-record fields addressed off the record pointer that have no ram.js offset name
// yet (only OBJ_X/OBJ_Y/OBJ_STATE do). Named here for their role in this walk.
const FINAL_X = 0x0e; // object's final X, latched when the walk completes
const FINAL_Y = 0x0f; // object's final Y, latched when the walk completes
const WALK_PTR_LO = 0x1a; // saved table pointer, low byte — the caller reloads it next pass
const WALK_PTR_HI = 0x1b; // saved table pointer, high byte
const WALK_FLAG_A = 0x13; // per-object animation-state bytes cleared on completion
const WALK_FLAG_B = 0x18; //   (their specific roles are not yet named in ram.js)
const WALK_FLAG_C = 0x1c;

/**
 * @param {object} m  the machine (uses m.regs and m.mem).
 * @returns {void}
 */
export function loc_3445(m) {
  const { regs, mem } = m;

  // The object record the caller points at (oracle boundary: the caller supplies it).
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
    mem.write8(field(WALK_PTR_LO), 0);
    mem.write8(field(WALK_PTR_HI), 0);
    return;
  }

  // Ordinary entry: it becomes the object's Y for this frame.
  mem.write8(field(OBJ_Y), entry);

  // Step the saved table pointer one byte forward and store it back, low then high.
  const next = u16(regs.hl + 1);
  mem.write8(field(WALK_PTR_LO), next); // low byte (the store truncates to 8 bits)
  mem.write8(field(WALK_PTR_HI), next >> 8); // high byte
}
