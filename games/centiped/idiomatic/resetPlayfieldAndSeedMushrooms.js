// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_8b, loc_8d, loc_8e, loc_8f, loc_c2, loc_d7, loc_ef,
  POKEY_RANDOM, PALETTE_COLOR_04, loc_0400, loc_0500, loc_0600, loc_0700,
} from "./names.js";
import { loadPaletteRecordPair } from "./loadPaletteRecordPair.js";
import { seedPlayerShotStartCells } from "./seedPlayerShotStartCells.js";

/**
 * resetPlayfieldAndSeedMushrooms -- clear the playfield and lay down the random mushroom carpet that
 * every fresh Centiped board starts with.
 *
 * ROM 0x28XX (playfield reset; the tail of initRoundState -- a fresh round always ends here). Grounding:
 * [code] -- read from the routine; the palette cell $1404 and POKEY RANDOM $100a are [seen], the bare
 * zero-page cells are behavioural placeholders.
 *
 * ROLE IN THE MACHINE. This is THE routine that brings the playfield to life at round start. It defines
 * the palette, wipes the video/object pages, then scatters mushrooms across the grid using the POKEY
 * hardware RNG. Because Centiped's mushroom layout must look random yet be reproducible, the draw is
 * "clock-free": it is only stable while the POKEY poly counter sits at its origin (the idiomatic layer
 * has no cycle clock, so it can only reproduce the RNG in that idle state -- see names.js POKEY_RANDOM).
 *
 * THE $ef FOLD MASK. As across the whole tile subsystem, $ef (loc_ef) both selects the column thresholds
 * and is XORed into every stamped tile, so one sweep paints both the upright and mirrored orientation.
 * A stamped mushroom is always `0x3f ^ $ef`.
 *
 * NO RTS OF ITS OWN. Its last act is a tail-call into seedPlayerShotStartCells, whose RTS returns to
 * THIS routine's caller -- so the playfield clear and the shot/start-cell seeding are one indivisible
 * reset act.
 *
 * LIVE-OUT: palette cell $1404 = 0x0f; the four pages $0400/$0500/$0600/$0700 zeroed; a random mushroom
 * carpet stamped across the grid (each `0x3f ^ $ef`); per-column $d7 tallies bumped for qualifying empty
 * cells; and the shot/start cells seeded by the tail call.
 */

const PALETTE_RESET_VALUE = 0x0f; // fixed playfield colour written into the $1404 palette cell
const SWEEP_START = 0x2d; //     the outer column sweep runs 0x2D..0x00 (46 columns)
const COLUMN_START = 0x1b; //    $8B column stride, cycles 0x1B down to 0x02 then wraps
const COLUMN_WRAP = 0x1b; //     stride wraps back to 0x1B once it would fall below the minimum
const COLUMN_MIN = 0x02; //      stride floor: it never goes below 0x02

export function resetPlayfieldAndSeedMushrooms(m) {
  const { mem8, mem16 } = m;

  // (1) Palette color + clear $C2+$88, then fan the first motion-object record via loadPaletteRecordPair.
  // The palette must be defined before anything is drawn; the $c2 slot (indexed by the actor slot $88)
  // is cleared, and loadPaletteRecordPair fans ROM colour record 0 out into the video palette triples.
  mem8[PALETTE_COLOR_04] = PALETTE_RESET_VALUE;
  mem8[(loc_c2 + mem8[loc_88]) & 0xff] = 0x00;
  loadPaletteRecordPair(m, 0x00); // record index 0

  // (2) Zero the four framebuffer / object pages a byte at a time, wiping any prior field. The loop runs
  // a full 256 iterations (i wraps 0x00 -> 0x00), covering all four 256-byte pages in lockstep.
  let i = 0x00;
  do {
    mem8[loc_0400 + i] = 0x00;
    mem8[loc_0500 + i] = 0x00;
    mem8[loc_0600 + i] = 0x00;
    mem8[loc_0700 + i] = 0x00;
    i = (i + 1) & 0xff;
  } while (i !== 0);

  // Clear this actor's $D7+$88 tally, then arm the column stride ($8B) for the sweep about to run.
  mem8[(loc_d7 + mem8[loc_88]) & 0xff] = 0x00;
  mem8[loc_8b] = COLUMN_START;

  // (3) The 46-column mushroom-seed sweep. The outer counter walks 0x2D down through 0x00.
  let col = SWEEP_START;
  do {
    // Build the pseudo-random cell pointer $8D/$8E from the POKEY RNG folded against the column stride.
    // $8D low byte = (RNG top 3 bits) | (stride $8B); $8E high byte = (RNG low 2 bits) | 0x04 (video
    // page base). Scatter comes from the RNG; reproducibility comes from the cycling stride.
    mem8[loc_8d] = (mem8[POKEY_RANDOM] & 0xe0) | mem8[loc_8b];
    mem8[loc_8e] = (mem8[POKEY_RANDOM] & 0x03) | 0x04;
    mem8[loc_8f] = col; // park the outer counter across the inner register clobbers

    // Decide whether this (empty) cell bumps the $D7+$88 tally. The index compared is $8D & 0x1F
    // (= the column stride); the threshold flips on whether $EF is zero. This is the same
    // orientation-keyed rule stampEmptyTileCell uses (below 0x0c upright / at-least 0x14 mirrored).
    const index = mem8[loc_8d] & 0x1f;
    const seedHere = mem8[loc_ef] === 0 ? index < 0x0c : index >= 0x14;
    const cellPtr = mem16[loc_8d];
    if (seedHere && mem8[cellPtr] === 0) {
      const tally = (loc_d7 + mem8[loc_88]) & 0xff;
      mem8[tally] = mem8[tally] + 1;
    }

    // Stamp the grid cell -- the canonical mushroom/solid tile value for this orientation.
    mem8[cellPtr] = 0x3f ^ mem8[loc_ef];

    // Advance the column stride $8B (cycles 0x1B..0x02, wrapping back to 0x1B at the floor) so the next
    // column samples a different slice of the RNG-folded address space.
    let stride = (mem8[loc_8b] - 1) & 0xff;
    if (stride < COLUMN_MIN) stride = COLUMN_WRAP;
    mem8[loc_8b] = stride;

    // Step the outer sweep counter (restored from the parked $8f); continue while it stays non-negative
    // (a 6502 `bpl`: bit 7 clear), i.e. down through 0x00 and out once it wraps to 0xff.
    col = (mem8[loc_8f] - 1) & 0xff;
  } while ((col & 0x80) === 0);

  // No RTS of its own: tail-call into seedPlayerShotStartCells (its RTS returns to this routine's caller).
  return seedPlayerShotStartCells(m);
}
