// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — hand one object's position to the grader, then fall into the shared object-sprite
 * tail. The object walk routes a slot here when the low three bits of the search-key field are 3.
 * It computes nothing and touches no work RAM: it stages the grader's three inputs — the search
 * key, a vertical discriminator five greater than the row field, and one column's worth of table
 * entries as the scan count — runs the grader, and jumps into the shared tail.
 * The two live-ins read as a POSITION because the grader compares the key against Mario's X and the
 * discriminator against Mario's Y − 4. NOT CLAIMED: why the row field is offset by five, and what
 * kind of object a slot with (search key & 7) == 3 holds.
 * LIVE-OUT: memory-only, plus the value the shared tail returns.
 */

import { startBarrelDescentAtLadder } from "./startBarrelDescentAtLadder.js";

// Entries per field column in the de-interleaved object-parameter table (the grader scans one).
const PARAM_TABLE_COLUMN = 21;

// How much higher than the record's row field the vertical discriminator sits.
const DISCRIMINATOR_OFFSET = 5;

export function loc_215f(
  m,
  searchKey = m.regs.h, /* defaults to the register the caller hands it in */
  rowField = m.regs.l,
) {
  const { regs } = m;

  // The grader and its own lookup take their inputs in registers, so stage them there.
  regs.d = rowField + DISCRIMINATOR_OFFSET;
  regs.a = searchKey;
  regs.bc = PARAM_TABLE_COLUMN;
  startBarrelDescentAtLadder(m);

  return m.call(0x21ba);
}
