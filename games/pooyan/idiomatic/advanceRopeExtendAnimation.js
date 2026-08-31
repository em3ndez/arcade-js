// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  ROPE_EXTEND_TIMER,
  ROPE_EXTEND_FRAME_INDEX,
  ROPE_EXTEND_STATE,
  ROPE_EXTEND_INDEX,
  ROPE_COLUMN_VRAM_PTR,
  ROPE_TILE_BLOCK_TABLE,
} from "./names.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";

/**
 * advanceRopeExtendAnimation — the "grow" animator for one rope segment.
 *
 * WHAT IT IS
 * The rope grows down the playfield one segment at a time under a tiny two-state machine
 * (ROPE_EXTEND_STATE, 0x8f14). State 0 (addRopeSegmentAndAdvanceExtendState) picks the next
 * segment: it chooses that segment's video-RAM column, seeds its per-cell timer, and switches
 * the machine to state 1. This routine IS state 1 — it plays out the chosen segment's grow
 * blit, drawing one animation frame of a 2x2 tile block per beat until the segment is fully
 * on screen, then hands the machine back to state 0 for the next segment down.
 *
 * ROLE IN THE MACHINE
 * A segment is not painted in a single frame; it eases in over several beats so the rope
 * appears to extend smoothly. This handler owns that easing. Its two timers are:
 *   - the hold sub-timer ROPE_EXTEND_TIMER (0x8f16), which paces the beats — one animation
 *     step every time it counts down through zero;
 *   - the blit frame index ROPE_EXTEND_FRAME_INDEX (0x8f1b), which counts 0..8 the steps
 *     already drawn for the current segment; 8 marks the segment finished.
 * When a segment finishes, the machine resets both back to the start and arms the freshly
 * grown cell so the per-cell rope driver begins servicing it (spawning riders, retracting,
 * and so on).
 *
 * ROM 0x2dbc-0x2ded. Grounding: [seen].
 *
 * LIVE-OUT (memory effects — this is a void handler, all effect is in RAM/VRAM):
 *   - ROPE_EXTEND_TIMER: decremented while the hold runs, else reloaded to 8.
 *   - ROPE_EXTEND_FRAME_INDEX: bumped per drawn step; zeroed when the segment completes.
 *   - ROPE_EXTEND_STATE: cleared to 0 on completion (returns the machine to state 0).
 *   - the four video-RAM cells of the segment's 2x2 tile block (via blit2x2TileBlock).
 *   - on completion, the freshly grown rope cell's state byte set to 1 (arm for servicing).
 */

// The hold sub-timer is reloaded to 8 each time it expires: 8 frames between animation beats.
const HOLD_RELOAD = 0x08;
// A segment's grow animation is complete after 8 drawn frames; frame index 8 is the terminal.
const FRAME_LIMIT = 0x08;

export function advanceRopeExtendAnimation(m) {
  const { mem8, mem16 } = m;

  // ---- Pace the animation: run the hold sub-timer down first. -------------------------------
  // While ROPE_EXTEND_TIMER (0x8f16) is still nonzero the current beat has not elapsed, so tick
  // it down one and do nothing else this frame. Only when it reaches zero does a new animation
  // step happen — this is what spaces the grow frames apart in time.
  if (mem8[ROPE_EXTEND_TIMER] !== 0) {
    mem8[ROPE_EXTEND_TIMER] = u8(mem8[ROPE_EXTEND_TIMER] - 1); // hold still running
    return;
  }
  // Timer expired: this frame carries an animation step. Reload the hold so the next step is
  // paced 8 frames out.
  mem8[ROPE_EXTEND_TIMER] = HOLD_RELOAD;

  // ---- Is the current segment's grow animation finished? ------------------------------------
  // ROPE_EXTEND_FRAME_INDEX (0x8f1b) counts how many grow frames have been drawn for this
  // segment. Reaching FRAME_LIMIT (8) means the segment is fully on screen.
  const frameIndex = mem8[ROPE_EXTEND_FRAME_INDEX];
  if (frameIndex === FRAME_LIMIT) {
    // Segment complete. Reset the frame index and drop the extend machine back to state 0
    // (0x8f14) so the next call adds the following segment.
    mem8[ROPE_EXTEND_FRAME_INDEX] = 0; // sequence done: reset index + state
    mem8[ROPE_EXTEND_STATE] = 0;
    // Arm the rope cell that just finished growing so the per-cell rope driver begins servicing
    // it. The cell's state byte lives in the 0x8f page at an offset keyed by the segment index
    // ROPE_EXTEND_INDEX (0x8f18): 0x8f00 | ((0x1b + index) & 0xff) — 0x1b being the low byte of
    // ROPE_EXTEND_FRAME_INDEX, the base of the per-cell state run. Writing 1 marks that cell live.
    const ropeIndex = mem8[ROPE_EXTEND_INDEX];
    // re-arm cell = page 0x8f | ((0x1b + ropeIndex) & 0xff); 0x1b is ROPE_EXTEND_FRAME_INDEX's low byte
    const rearm = (ROPE_EXTEND_FRAME_INDEX & ~0xff) | ((ROPE_EXTEND_FRAME_INDEX + ropeIndex) & 0xff);
    mem8[rearm] = 0x01;
    return;
  }

  // ---- Draw one grow frame of the segment. -------------------------------------------------
  // Look up this frame's 2x2 tile-block word from the ROM block table ROPE_TILE_BLOCK_TABLE
  // (0x2dee), indexed by the current frame number — successive frames select progressively
  // "taller" blocks so the segment appears to extend.
  const block = fetchWordFromTableIndex(m, frameIndex, ROPE_TILE_BLOCK_TABLE); // tile-block word for this frame
  // Stamp that 2x2 block into video RAM at the segment's column base ROPE_COLUMN_VRAM_PTR
  // (0x8f19), a page-0x84 tilemap address the state-0 handler chose when it added the segment.
  blit2x2TileBlock(m, mem16[ROPE_COLUMN_VRAM_PTR], block);
  // Advance to the next grow frame for the next beat.
  mem8[ROPE_EXTEND_FRAME_INDEX] = u8(mem8[ROPE_EXTEND_FRAME_INDEX] + 1);
}
