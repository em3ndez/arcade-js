// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { appendWriteAnimBlockRowOnPhase } from "./appendWriteAnimBlockRowOnPhase.js";
import { floodWriteAnimCellsAndLatchPhase } from "./floodWriteAnimCellsAndLatchPhase.js";
import {
  loc_8e21,
  WRITE_ANIM_TILE_INDEX,
  WRITE_ANIM_STEP_DELAY,
  WRITE_ANIM_WRITE_PTR,
  WRITEANIM_COUNTDOWN,
} from "./names.js";

/**
 * advanceWriteAnimTileIndexOnCountdown
 * ====================================
 *
 * WHAT IT IS
 *   The first of the three "write-anim" handlers. The write-anim is the little on-screen
 *   sequence that grows a block of tiles one row at a time -- the lettering that draws itself
 *   out on the high-score name-entry / round-end screen. Once per frame a pre-pass
 *   (dispatchWriteAnimStateAndPollStart) selects exactly one of the three handlers through the
 *   state selector WRITE_ANIM_HANDLER_SELECT (0x8e26):
 *     0 -> seedWriteAnimWorkBlock               (set the block up)
 *     1 -> advanceWriteAnimTileIndexOnCountdown (this routine -- step the tile the block draws from)
 *     2 -> appendWriteAnimBlockRowOnPhase       (stamp one more row)
 *   This handler takes no register input -- everything it needs it reads from the animation's
 *   work-block cells in RAM.
 *
 * ROLE IN THE MACHINE
 *   This is the "advance the tile the block is drawn from" step. It does two jobs in order.
 *   First it drains a 16-bit inter-row countdown; that counter is re-seeded to 0x03a0 by
 *   appendWriteAnimBlockRowOnPhase every time a row fires, so if it ever reaches zero before the
 *   next row is laid the animation has run out its allotted time and control hands off to the
 *   shared terminal step floodWriteAnimCellsAndLatchPhase (which tears the animation down).
 *   Otherwise it reads a direction flag byte the animation is currently pointing at and, on the
 *   frames it is actually due to move, steps the tile index the growing block is stamped from --
 *   either up or down through a fixed 0x10..0x2c band, wrapping at the ends -- then falls into
 *   appendWriteAnimBlockRowOnPhase to (maybe) lay the next row of the block.
 *
 * ROM ADDRESS
 *   0x7f0e-0x7f5c.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT (all in memory -- this is a void handler, nothing is returned to its caller):
 *   Every frame:
 *     - WRITEANIM_COUNTDOWN (0x8e2b, 16-bit) decremented by one.
 *   When that countdown reaches zero:
 *     - control hands off to floodWriteAnimCellsAndLatchPhase, which finishes the animation.
 *   When the flag byte selects "no step" (bit 3 clear, bit 2 clear):
 *     - control falls into appendWriteAnimBlockRowOnPhase with the tile index untouched.
 *   When the flag byte selects an UP or DOWN step:
 *     - WRITE_ANIM_STEP_DELAY (0x8e24) decremented; while it is still counting the routine
 *       returns and nothing else changes;
 *     - on the frame it expires: WRITE_ANIM_STEP_DELAY reseeded to 0x0c, WRITE_ANIM_TILE_INDEX
 *       (0x8e23) stepped one in the chosen direction and wrapped to stay within 0x10..0x2c, that
 *       stepped index byte written through the video pointer WRITE_ANIM_WRITE_PTR (0x8e27), and
 *       control falls into appendWriteAnimBlockRowOnPhase.
 */


const RELOAD_VALUE = 0x0c; //     value the reload sub-timer is re-seeded to on expiry
const INDEX_LO = 0x10; //         low index bound; a DOWN step below it wraps to INDEX_HI
const INDEX_HI = 0x2c; //         high index bound; an UP step above it wraps to INDEX_LO

export function advanceWriteAnimTileIndexOnCountdown(m) {
  const { mem8 } = m;

  // Step 1 -- drain the 16-bit inter-row countdown, and end the animation if it empties.
  // WRITEANIM_COUNTDOWN (low byte 0x8e2b, high byte 0x8e2c) is the delay between drawn rows;
  // appendWriteAnimBlockRowOnPhase re-seeds it to 0x03a0 each time it fires a row. Read the pair
  // little-endian, subtract one, and store it back (u16 keeps it a 16-bit value). When it drains
  // to zero the animation has run out its time: hand off to the shared terminal step
  // floodWriteAnimCellsAndLatchPhase, which silences the sound, blanks the animated cells, and
  // latches the state that ends the write-anim.
  const counter = u16((mem8[WRITEANIM_COUNTDOWN] | (mem8[WRITEANIM_COUNTDOWN + 1] << 8)) - 1);
  mem8[WRITEANIM_COUNTDOWN] = counter;
  mem8[WRITEANIM_COUNTDOWN + 1] = (counter >> 8);
  if (counter === 0) return floodWriteAnimCellsAndLatchPhase(m);

  // Step 2 -- read the direction flag byte the animation is currently pointing at.
  // A 16-bit source pointer at loc_8e21 (0x8e21) walks the data the animation is playing back;
  // dereference it (low byte | high byte << 8) and read the byte it addresses. That byte's bits
  // decide how the tile index moves this pass: bit 3 set = step DOWN, bit 3 clear + bit 2 set =
  // step UP, both clear = do not step at all.
  const flags = mem8[mem8[loc_8e21] | (mem8[loc_8e21 + 1] << 8)];

  if (flags & 0x08) {
    // bit 3 set -- the tile index counts DOWN through the band.
    // Tick the per-step reload sub-timer WRITE_ANIM_STEP_DELAY (0x8e24) first; while it is still
    // counting, return without stepping (this paces how fast the tile marches). When it hits zero,
    // reseed it to RELOAD_VALUE (0x0c), decrement the tile index WRITE_ANIM_TILE_INDEX (0x8e23),
    // and if it has dropped below the low bound INDEX_LO (0x10) wrap it back up to INDEX_HI (0x2c).
    mem8[WRITE_ANIM_STEP_DELAY] = mem8[WRITE_ANIM_STEP_DELAY] - 1;
    if (mem8[WRITE_ANIM_STEP_DELAY] !== 0) return;
    mem8[WRITE_ANIM_STEP_DELAY] = RELOAD_VALUE;
    mem8[WRITE_ANIM_TILE_INDEX] = mem8[WRITE_ANIM_TILE_INDEX] - 1;
    if (mem8[WRITE_ANIM_TILE_INDEX] < INDEX_LO) mem8[WRITE_ANIM_TILE_INDEX] = INDEX_HI; // wrap up past the low bound
  } else if ((flags & 0x04) === 0) {
    // bit 3 clear, bit 2 clear -- no index step this pass.
    // Nothing to move; fall straight through to the row-stamping handler, which decides on its
    // own phase ring whether to lay another row this frame.
    return appendWriteAnimBlockRowOnPhase(m);
  } else {
    // bit 3 clear, bit 2 set -- the tile index counts UP through the band.
    // Same pacing as the DOWN path: tick WRITE_ANIM_STEP_DELAY (0x8e24) and return while it is
    // still counting; on expiry reseed it to RELOAD_VALUE (0x0c), increment WRITE_ANIM_TILE_INDEX
    // (0x8e23), and if it has climbed above the high bound INDEX_HI (0x2c) wrap it back down to
    // INDEX_LO (0x10).
    mem8[WRITE_ANIM_STEP_DELAY] = mem8[WRITE_ANIM_STEP_DELAY] - 1;
    if (mem8[WRITE_ANIM_STEP_DELAY] !== 0) return;
    mem8[WRITE_ANIM_STEP_DELAY] = RELOAD_VALUE;
    mem8[WRITE_ANIM_TILE_INDEX] = mem8[WRITE_ANIM_TILE_INDEX] + 1;
    if (mem8[WRITE_ANIM_TILE_INDEX] > INDEX_HI) mem8[WRITE_ANIM_TILE_INDEX] = INDEX_LO; // wrap down past the high bound
  }

  // Step 3 -- stamp the freshly stepped tile index into the tilemap, then lay the next row.
  // WRITE_ANIM_WRITE_PTR (0x8e27, 16-bit) points at the video-RAM cell for the current row; read
  // it little-endian and write the stepped tile index WRITE_ANIM_TILE_INDEX (0x8e23) through it so
  // the on-screen tile changes, then fall into appendWriteAnimBlockRowOnPhase to append/advance
  // the growing block.
  const dest = mem8[WRITE_ANIM_WRITE_PTR] | (mem8[WRITE_ANIM_WRITE_PTR + 1] << 8);
  mem8[dest] = mem8[WRITE_ANIM_TILE_INDEX];
  return appendWriteAnimBlockRowOnPhase(m);
}
