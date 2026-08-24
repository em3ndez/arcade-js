// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_7fa8 } from "./loc_7fa8.js";
import {
  PLAYER2_START_CLEAR_BLOCK,
  loc_8e21,
  loc_8e23,
  loc_8e25,
  loc_8e26,
  loc_8e27,
  loc_8e29,
  loc_8e2b,
} from "./names.js";

/**
 * loc_7f5d — write-anim dispatch entry 2. Rotates one phase bit into a ring, then advances a
 * block-build state on the accept phase.
 *
 * Takes bit 4 of the source byte and rotates it into the phase ring; unless the ring's low three
 * bits settle on the fire phase it returns. On that phase it appends the index byte to the growing
 * block, decrements the row countdown, and either tail-delegates to the shared tail (countdown
 * drained) or steps the row pointer back one row and re-primes.
 *
 * LIVE-OUT: memory only — a void handler; no register survives.
 */

const FIRE_PHASE = 0x01; // ring low-3 value that opens the block-build step
const RING_MASK = 0x07;
const SEED_2B = 0x03a0; //   16-bit value stamped on the fire phase
const ROW_STRIDE = 0x20; //  one row; the row pointer is backed up by this
const REPRIME = 0x11; //     re-primed into the index byte and written at the backed-up row pointer

export function loc_7f5d(m) {
  const { mem8, mem16 } = m;

  const src = mem8[mem16[loc_8e21]]; //             byte at the source pointer
  const bit4 = (src >> 4) & 1;
  const ring = ((mem8[loc_8e29] << 1) | bit4) & 0xff; // shift bit 4 into the phase ring
  mem8[loc_8e29] = ring;
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: only the ring advanced

  mem16[loc_8e2b] = SEED_2B;

  // append the index byte to the block and advance the write-pointer
  const appendPtr = mem16[PLAYER2_START_CLEAR_BLOCK];
  mem8[appendPtr] = mem8[loc_8e23];
  mem16[PLAYER2_START_CLEAR_BLOCK] = u16(appendPtr + 1);

  const countdown = u8(mem8[loc_8e25] - 1);
  mem8[loc_8e25] = countdown;
  if (countdown === 0) return loc_7fa8(m); // countdown drained -> tail delegate

  // row step: write the index byte at the row pointer, back it up one row, seed + reprime
  const rowSrc = mem8[loc_8e23]; //                   read before the re-prime below
  const rowPtr = mem16[loc_8e27];
  mem8[rowPtr] = rowSrc;
  const backed = u16(rowPtr - ROW_STRIDE);
  mem16[loc_8e27] = backed;
  mem8[backed] = REPRIME;
  mem8[loc_8e26] = 0x01;
  mem8[loc_8e23] = REPRIME;
}
