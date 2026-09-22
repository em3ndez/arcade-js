// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — hand one object's position to the grader, then fall into the shared object-sprite
 * tail. The object walk routes a slot here when the low three bits of the search-key field are 3.
 * It computes nothing and touches no work RAM: it stages the grader's three inputs — the search
 * key, a vertical discriminator five greater than the row field, and one column's worth of table
 * entries as the scan count — runs the grader, and jumps into the shared tail.
 * The two live-ins read as a POSITION: the grader compares the key against Mario's X and the
 * discriminator against Mario's Y − 4. LIVE-OUT: memory-only, plus the shared tail's return.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { startBarrelDescentAtLadder } from "./startBarrelDescentAtLadder.js";

// Entries per field column in the de-interleaved object-parameter table (the grader scans one).
const PARAM_TABLE_COLUMN = 21;

// How much higher than the record's row field the vertical discriminator sits.
const DISCRIMINATOR_OFFSET = 5;

export function loc_215f(m, cur, searchKey = m.regs.h, rowField = m.regs.l) {
  // Hand the grader its position and scan count as values; the register-shaped seam lives inside it.
  const disc = rowField + DISCRIMINATOR_OFFSET;
  startBarrelDescentAtLadder(m, disc, searchKey, PARAM_TABLE_COLUMN);

  return publishBarrelSprite(m, cur);
}
