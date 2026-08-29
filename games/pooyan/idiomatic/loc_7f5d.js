// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { loc_7fa8 } from "./loc_7fa8.js";
import {
  ANIM_WORK_BLOCK_PTR,
  loc_8e21,
  WRITE_ANIM_TILE_INDEX,
  WRITE_ANIM_ROW_COUNT,
  WRITE_ANIM_HANDLER_SELECT,
  WRITE_ANIM_WRITE_PTR,
  WRITEANIM_PHASE_RING,
  WRITEANIM_COUNTDOWN,
  FIRE_PHASE_SEED,
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
const ROW_STRIDE = 0x20; //  one row; the row pointer is backed up by this
const REPRIME = 0x11; //     re-primed into the index byte and written at the backed-up row pointer

export function loc_7f5d(m) {
  const { mem8, mem16 } = m;

  const src = mem8[mem16[loc_8e21]]; //             byte at the source pointer
  const bit4 = (src >> 4) & 1;
  const ring = ((mem8[WRITEANIM_PHASE_RING] << 1) | bit4) & 0xff; // shift bit 4 into the phase ring
  mem8[WRITEANIM_PHASE_RING] = ring;
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: only the ring advanced

  mem16[WRITEANIM_COUNTDOWN] = FIRE_PHASE_SEED;

  // append the index byte to the block and advance the write-pointer
  const appendPtr = mem16[ANIM_WORK_BLOCK_PTR];
  mem8[appendPtr] = mem8[WRITE_ANIM_TILE_INDEX];
  mem16[ANIM_WORK_BLOCK_PTR] = u16(appendPtr + 1);

  const countdown = u8(mem8[WRITE_ANIM_ROW_COUNT] - 1);
  mem8[WRITE_ANIM_ROW_COUNT] = countdown;
  if (countdown === 0) return loc_7fa8(m); // countdown drained -> tail delegate

  // row step: write the index byte at the row pointer, back it up one row, seed + reprime
  const rowSrc = mem8[WRITE_ANIM_TILE_INDEX]; //                   read before the re-prime below
  const rowPtr = mem16[WRITE_ANIM_WRITE_PTR];
  mem8[rowPtr] = rowSrc;
  const backed = u16(rowPtr - ROW_STRIDE);
  mem16[WRITE_ANIM_WRITE_PTR] = backed;
  mem8[backed] = REPRIME;
  mem8[WRITE_ANIM_HANDLER_SELECT] = 0x01;
  mem8[WRITE_ANIM_TILE_INDEX] = REPRIME;
}
