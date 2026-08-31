// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import { floodWriteAnimCellsAndLatchPhase } from "./floodWriteAnimCellsAndLatchPhase.js";
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
 * appendWriteAnimBlockRowOnPhase
 * ==============================
 *
 * WHAT IT IS
 *   The second of the three "write-anim" handlers. The write-anim is the little on-screen
 *   sequence that grows a block of tiles one row at a time -- the lettering that draws itself
 *   out on the high-score name-entry / round-end screen. Once per frame a pre-pass
 *   (dispatchWriteAnimStateAndPollStart) picks exactly one of the three handlers through the
 *   state selector WRITE_ANIM_HANDLER_SELECT (0x8e26):
 *     0 -> seedWriteAnimWorkBlock             (set the block up)
 *     1 -> advanceWriteAnimTileIndexOnCountdown (step the tile the block is drawn from)
 *     2 -> appendWriteAnimBlockRowOnPhase       (this routine -- stamp one more row)
 *   Handler 1 also falls straight into this one for the frames where it does not step the
 *   index, so most of the block's growth is driven from here.
 *
 * ROLE IN THE MACHINE
 *   This is the "maybe stamp one more row" step. It does not fire every frame: it rotates a
 *   phase ring one bit per frame and only acts when the ring settles on its fire phase, which
 *   paces the block's growth so a row appears every few frames rather than all at once. On a
 *   fire frame it appends the current tile to the growing work block, counts one row off the
 *   remaining-rows tally, and -- while rows remain -- stamps that tile into video RAM, backs
 *   the video pointer up one tilemap row, and re-primes the block for the next pass. When the
 *   row tally reaches zero the whole animation is finished, so control hands off to the shared
 *   terminal step floodWriteAnimCellsAndLatchPhase, which tears the animation down.
 *
 * ROM ADDRESS
 *   0x7f5d-0x7fa7.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT (all in memory -- this is a void handler, nothing is returned to its caller):
 *   Off a fire frame:
 *     - WRITEANIM_PHASE_RING (0x8e29) advanced by one bit; nothing else changes.
 *   On a fire frame:
 *     - WRITEANIM_PHASE_RING (0x8e29) advanced (as above);
 *     - WRITEANIM_COUNTDOWN (0x8e2b, 16-bit) reseeded to FIRE_PHASE_SEED (0x03a0);
 *     - one tile byte appended at ANIM_WORK_BLOCK_PTR (0x8e1f), which is bumped forward one;
 *     - WRITE_ANIM_ROW_COUNT (0x8e25) decremented by one;
 *     - if that hit zero: the tail (floodWriteAnimCellsAndLatchPhase) runs and finishes the anim;
 *     - otherwise: the tile stamped at WRITE_ANIM_WRITE_PTR (0x8e27), that pointer backed up one
 *       tilemap row (0x20) with the re-prime tile 0x11 stamped at the new spot,
 *       WRITE_ANIM_HANDLER_SELECT (0x8e26) forced to 1, and WRITE_ANIM_TILE_INDEX (0x8e23)
 *       reset to the re-prime tile 0x11.
 */

const FIRE_PHASE = 0x01; // ring low-3 value that opens the block-build step
const RING_MASK = 0x07; //   only the low three bits of the ring are the phase counter
const ROW_STRIDE = 0x20; //  one tilemap row; the video write pointer is backed up by this
const REPRIME = 0x11; //     re-primed into the index byte and written at the backed-up row pointer

export function appendWriteAnimBlockRowOnPhase(m) {
  const { mem8, mem16 } = m;

  // Advance the phase ring by one bit.
  // A source pointer at loc_8e21 (0x8e21) points at the byte the animation is currently reading;
  // bit 4 of that byte is this frame's phase input. Shift the phase ring (WRITEANIM_PHASE_RING,
  // 0x8e29) left one and drop the fresh bit 4 into the low bit, keeping the byte 8 bits wide.
  const src = mem8[mem16[loc_8e21]]; //             byte at the source pointer
  const bit4 = (src >> 4) & 1;
  const ring = ((mem8[WRITEANIM_PHASE_RING] << 1) | bit4) & 0xff; // shift bit 4 into the phase ring
  mem8[WRITEANIM_PHASE_RING] = ring;
  // Gate on the phase. Only the low three bits count as the phase, and only the exact fire
  // value (0x01) opens the block-build step. Any other phase means this is an "off" frame: the
  // ring has already been advanced above, so there is nothing more to do -- return.
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: only the ring advanced

  // --- fire frame: build one more row of the block ---

  // Reseed the 16-bit inter-row countdown (WRITEANIM_COUNTDOWN, 0x8e2b) to FIRE_PHASE_SEED
  // (0x03a0). Handler 1 (advanceWriteAnimTileIndexOnCountdown) drains this counter each frame;
  // reseeding it here restarts the delay before the next row is drawn.
  mem16[WRITEANIM_COUNTDOWN] = FIRE_PHASE_SEED;

  // Append the current tile to the growing block record.
  // ANIM_WORK_BLOCK_PTR (0x8e1f) is the write cursor into the work-block record run. Store the
  // current tile index (WRITE_ANIM_TILE_INDEX, 0x8e23) at the cursor and bump the cursor one
  // byte forward, wrapping to 16 bits, so the next appended tile lands in the following slot.
  const appendPtr = mem16[ANIM_WORK_BLOCK_PTR];
  mem8[appendPtr] = mem8[WRITE_ANIM_TILE_INDEX];
  mem16[ANIM_WORK_BLOCK_PTR] = u16(appendPtr + 1);

  // Count one row off the remaining-rows tally.
  // WRITE_ANIM_ROW_COUNT (0x8e25) is seeded to 3 and decremented once per appended row. When it
  // reaches zero the block is fully drawn: hand off to the shared terminal step, which silences
  // the sound, blanks the animated cells, and latches the state that ends the write-anim.
  const countdown = u8(mem8[WRITE_ANIM_ROW_COUNT] - 1);
  mem8[WRITE_ANIM_ROW_COUNT] = countdown;
  if (countdown === 0) return floodWriteAnimCellsAndLatchPhase(m); // countdown drained -> tail delegate

  // Rows still remain: stamp this row into video RAM and re-prime for the next pass.
  // Read the current tile index *before* the re-prime overwrites it below, then write it through
  // the video write pointer WRITE_ANIM_WRITE_PTR (0x8e27), which points at the tilemap cell for
  // this row. Back that pointer up one full tilemap row (0x20 bytes = one row above) so the next
  // pass draws the row above this one, and stamp the re-prime tile (0x11) at the new cell. Force
  // the state selector (WRITE_ANIM_HANDLER_SELECT, 0x8e26) back to 1 so next frame runs the
  // index-step handler, and reset the tile index (WRITE_ANIM_TILE_INDEX, 0x8e23) to the re-prime
  // tile so the next row starts from a known value.
  const rowSrc = mem8[WRITE_ANIM_TILE_INDEX]; //                   read before the re-prime below
  const rowPtr = mem16[WRITE_ANIM_WRITE_PTR];
  mem8[rowPtr] = rowSrc;
  const backed = u16(rowPtr - ROW_STRIDE);
  mem16[WRITE_ANIM_WRITE_PTR] = backed;
  mem8[backed] = REPRIME;
  mem8[WRITE_ANIM_HANDLER_SELECT] = 0x01;
  mem8[WRITE_ANIM_TILE_INDEX] = REPRIME;
}
