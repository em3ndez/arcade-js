// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — hand one object's position to the grader, then fall into the shared object-
 * sprite tail.
 *
 * The object walk routes a slot here when the low three bits of the field that becomes the
 * search key are 3. This routine computes nothing of its own and touches no work RAM: it
 * stages the three values the grader works from — that search key, a vertical discriminator
 * five greater than the row field, and one column's worth of table entries as the scan count
 * — runs the grader, and jumps into the tail every branch of that walk shares.
 *
 * WHAT THE ROLE LINE RESTS ON, AND WHERE IT STOPS. Reading the two live-ins as a POSITION is
 * the grader's derivation, not a restatement of this body: the grader compares the key
 * against Mario's X and the discriminator against Mario's Y − 4, so the pair is positional
 * rather than two opaque tags. The scan count is the stride of the de-interleaved
 * object-parameter table — the number of entries per field column, not an arbitrary limit:
 * the loader scatters each record's three fields one column apart, and the ladder-pairing
 * lookup reads the two paired slots at exactly one and two counts past a match.
 *
 * NOT CLAIMED, because it was not derived here: why the row field is offset by five before it
 * becomes the discriminator, and what kind of object a slot selected by
 * (search key & 7) == 3 holds.
 *
 * LIVE-OUT: memory-only, plus the value the shared tail returns.
 */

import { startBarrelDescentAtLadder } from "./startBarrelDescentAtLadder.js";

// Entries per field column in the de-interleaved object-parameter table: the grader's
// lookup scans exactly one column, and the paired slots it returns sit one and two
// columns further on.
const PARAM_TABLE_COLUMN = 21;

// How much higher than the record's row field the vertical discriminator sits.
const DISCRIMINATOR_OFFSET = 5;

export function loc_215f(
  m,
  searchKey = m.regs.h, /* defaults to the register the caller hands it in */
  rowField = m.regs.l, /* defaults to the register the caller hands it in */
) {
  const { regs } = m;

  // The grader and its own lookup take their inputs in registers, so stage them there.
  regs.d = rowField + DISCRIMINATOR_OFFSET;
  regs.a = searchKey;
  regs.bc = PARAM_TABLE_COLUMN;
  startBarrelDescentAtLadder(m);

  return m.call(0x21ba);
}
