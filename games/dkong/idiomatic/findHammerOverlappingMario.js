// SPDX-License-Identifier: GPL-3.0-only
/**
 * findHammerOverlappingMario — test whether Mario overlaps either of the two hammer objects,
 * and report which one.
 *
 * A thin front end over the shared object-list bounding-box search. It fixes the search
 * parameters for this one query and runs it once:
 *   • the records are the two-object hammer pair, scanned with the object-record stride;
 *   • the reference point is Mario — his Y as the first axis, and his X as the second, reached
 *     by aiming the reference pointer at the base of his live block so that the byte the search
 *     reads for the second axis is his X;
 *   • the per-axis base tolerances are 8 on the first axis and 4 on the second.
 * The search stops at the first active record whose box overlaps Mario on both axes.
 *
 * Both outcomes resume the caller. The shared search uses a caller-skip convention on a hit,
 * returning one level further up, but toward THIS routine's caller the effect is the same
 * either way: control comes back with the result in the register file.
 *
 * EVERY OFFSET HERE IS AN OBJECT-RECORD FIELD. The first axis compares against a record's Y
 * with an extra span field, the second against its X with its own span field. No sprite-record
 * offset is involved.
 *
 * WHY "HAMMER": the same object pair is what the hammer's own sprite driver moves, choosing
 * between the two records on a bit of the first record's in-play flag. The pair is seeded only
 * by the setups of the three boards that have hammers, and never on the one hammer-free board.
 * The caller records a "touched but not yet held hammer" from this search's result and triggers
 * the hammer-grab sound.
 *
 * WHAT THE NAME DOES NOT CLAIM: that anything is picked up — this routine writes no memory at
 * all and only reports an overlap; which of the hammers is which; or how many hammers a board
 * shows. The pair is always two records, seeded from three different position tables that
 * nobody has decoded.
 *
 * Reads: Mario's Y, and through the search the two records and Mario's X. Writes: nothing.
 *
 * LIVE-OUT: registers only, left exactly as the search leaves them — a hit/miss byte, and on a
 * hit the record count minus the matched record's index, from which the caller recovers the
 * index. This routine itself returns nothing.
 */

import { MARIO_ACTIVE, MARIO_Y, OBJ_PAIR_6680 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function findHammerOverlappingMario(m) {
  const { regs, mem } = m;

  // Reference-point pointer: the base of Mario's live block, so the byte the search reads for
  // the second axis is Mario's X.
  regs.iy = MARIO_ACTIVE;

  // First-axis reference coordinate: Mario's Y.
  regs.a = mem.read8(MARIO_Y);
  regs.c = regs.a;

  // Per-axis base tolerances: 8 on the first axis, 4 on the second.
  regs.hl = 0x0408;

  // Scan the two-record hammer pair, one object record apart.
  regs.b = 0x02;
  regs.de = 0x0010;
  regs.ix = OBJ_PAIR_6680;

  // Run the search once. It leaves the hit flag and the count-minus-index residue in the
  // register file; its caller-skip return is ignored here, since both outcomes resume the
  // caller.
  findCollidingObject(m);
}
