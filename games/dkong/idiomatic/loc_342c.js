// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_342c — start or resume one object's scripted position walk, advance its X one step,
 * then hand to the shared table-walk tail.  ROM 0x342C.
 *
 * The head of one of the two object-animation walkers (its twin at 0x3478 shares the same
 * tail). Each call drives one object whose record the caller points at through one step of
 * a scripted path: THIS routine owns the object's horizontal march and the walk's start/resume
 * decision, while the tail (loc_3445) reads the next table entry into the object's Y and
 * bookkeeps the saved pointer.
 *
 *   • The saved 16-bit table pointer is reloaded from the object record. If it is zero the
 *     walk has not started (or was just finished and rewound), so this is a FRESH start: aim
 *     at the path table's beginning and stamp the object's starting X. If it is non-zero the
 *     walk is already in progress, so keep the saved position.
 *
 *   • Either way the object's X is then advanced one step this frame — so on a fresh start the
 *     first frame's X is the seed plus one, and every later frame adds one more, marching the
 *     object sideways while the tail supplies its Y from the table.
 *
 *   • The resolved table pointer and the object record are handed to loc_3445, which reads the
 *     next entry: an ordinary entry becomes the object's Y and advances the saved pointer; the
 *     end-of-table marker finalizes the walk (latches the final X/Y and rewinds the pointer to
 *     zero, which is what makes the next call read as a fresh start here).
 *
 * REGISTER-ABI MARSHALLING (dissolves once loc_3445 takes honest args): loc_3445 is still an
 * oracle boundary that reads the object record and the walk pointer from registers, so this
 * routine leaves the record pointer in place (unchanged live-in) and loads the resolved table
 * pointer exactly where loc_3445 expects it before calling.
 *
 * NAME: kept the neutral loc_ baseline — the mechanism (start/resume a scripted walk and march
 * the X) is pinned to the oracle, but which object/cutscene this animates is not yet
 * corroborated to the routine-name bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-342c.test.js.
 * GATE:     strict memory-equivalence; factored-exhaustive over the fresh/resume split, the X
 *           advance (incl. the 8-bit wrap), the 16-bit pointer reload+step, and both tail arms
 *           (ordinary entry / end-of-table), plus real captured 0x342C attract dispatches.
 * LIVE-OUT: memory-only — the caller drives control flow and reads the object back through its
 *           record next pass; the oracle's residual registers/flags and its terminal return are
 *           dead.
 * NAMES:    OBJ_X (record +0x03), OBJ_WALK_PTR_LO (+0x1a), OBJ_WALK_PTR_HI (+0x1b) — object-record
 *           offsets from ram.js. TABLE_START (0x3A8C) is a ROM address, kept hex.
 */

import { OBJ_X, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "./ram.js";
import { loc_3445 } from "./loc_3445.js"; // ROM 0x3445 — the shared table-walk + finalize tail

// ROM address of the object's scripted Y-path table (the walk's starting point).
const TABLE_START = 0x3a8c;
// The object's starting X, stamped on the first pass of a fresh walk.
const X_SEED = 38;

/**
 * @param {object} m  the machine (uses m.regs and m.mem).
 * @returns {void}
 */
export function loc_342c(m) {
  const { regs, mem } = m;

  // The object record the caller points at (oracle boundary: the caller supplies it, and the
  // tail reads it from the same place).
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
