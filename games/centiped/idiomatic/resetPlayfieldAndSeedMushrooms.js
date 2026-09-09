// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_8b, loc_8d, loc_8e, loc_8f, loc_c2, loc_d7, loc_ef,
  loc_100a, loc_1404, loc_0400, loc_0500, loc_0600, loc_0700,
} from "./names.js";
import { loadPaletteRecordPair } from "./loadPaletteRecordPair.js";
import { seedPlayerShotStartCells } from "./seedPlayerShotStartCells.js";

/**
 * resetPlayfieldAndSeedMushrooms -- clear the playfield and lay down the random
 * mushroom grid: write a fixed palette color, clear two cells and load the first
 * motion-object record, zero the four framebuffer/object pages, then walk a
 * 46-column sweep. Each column builds a pseudo-random cell pointer $8D/$8E from
 * POKEY RANDOM and the cycling column index $8B, bumps a per-column $D7 tally for
 * an empty cell, and stamps the cell with 0x3f ^ $EF. The random sequence is only
 * reproducible while the poly counter is idle (clock-free layer). No RTS of its
 * own -- falls straight through into the shot/start-cell seeding as a tail call. [code]
 */

const PALETTE_RESET_VALUE = 0x0f;
const SWEEP_START = 0x2d; //     the outer column sweep runs 0x2D..0x00 (46 columns)
const COLUMN_START = 0x1b; //    $8B column stride, cycles 0x1B down to 0x02 then wraps
const COLUMN_WRAP = 0x1b;
const COLUMN_MIN = 0x02;

export function resetPlayfieldAndSeedMushrooms(m) {
  const { mem8, mem16 } = m;

  // (1) Palette color + clear $C2+$88, then fan the first motion-object record via loadPaletteRecordPair.
  mem8[loc_1404] = PALETTE_RESET_VALUE;
  mem8[(loc_c2 + mem8[loc_88]) & 0xff] = 0x00;
  loadPaletteRecordPair(m, 0x00); // record index 0

  // (2) Zero the four framebuffer / object pages.
  let i = 0x00;
  do {
    mem8[loc_0400 + i] = 0x00;
    mem8[loc_0500 + i] = 0x00;
    mem8[loc_0600 + i] = 0x00;
    mem8[loc_0700 + i] = 0x00;
    i = (i + 1) & 0xff;
  } while (i !== 0);

  // Clear the $D7+$88 tally, then arm the column stride ($8B) for the sweep.
  mem8[(loc_d7 + mem8[loc_88]) & 0xff] = 0x00;
  mem8[loc_8b] = COLUMN_START;

  // (3) The 46-column mushroom-seed sweep.
  let col = SWEEP_START;
  do {
    // Build the pseudo-random cell pointer from POKEY RANDOM + the column stride.
    mem8[loc_8d] = (mem8[loc_100a] & 0xe0) | mem8[loc_8b];
    mem8[loc_8e] = (mem8[loc_100a] & 0x03) | 0x04;
    mem8[loc_8f] = col; // park the outer counter across the inner register clobbers

    // Decide whether this (empty) cell bumps the $D7+$88 tally. The index compared is $8D & 0x1F
    // (= the column stride); the threshold flips on whether $EF is zero.
    const index = mem8[loc_8d] & 0x1f;
    const seedHere = mem8[loc_ef] === 0 ? index < 0x0c : index >= 0x14;
    const cellPtr = mem16[loc_8d];
    if (seedHere && mem8[cellPtr] === 0) {
      const tally = (loc_d7 + mem8[loc_88]) & 0xff;
      mem8[tally] = mem8[tally] + 1;
    }

    // Stamp the grid cell.
    mem8[cellPtr] = 0x3f ^ mem8[loc_ef];

    // Advance the column stride $8B (cycles 0x1B..0x02).
    let stride = (mem8[loc_8b] - 1) & 0xff;
    if (stride < COLUMN_MIN) stride = COLUMN_WRAP;
    mem8[loc_8b] = stride;

    // Step the outer sweep counter; continue while it stays non-negative (bpl).
    col = (mem8[loc_8f] - 1) & 0xff;
  } while ((col & 0x80) === 0);

  // No RTS of its own: tail-call into seedPlayerShotStartCells (its RTS returns to this routine's caller).
  return seedPlayerShotStartCells(m);
}
