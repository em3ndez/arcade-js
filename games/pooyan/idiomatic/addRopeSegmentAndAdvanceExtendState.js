// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  WAVE_ARRIVAL_COUNTER,
  ROPE_SEGMENT_COUNT,
  ROPE_EXTEND_INDEX,
  ROPE_EXTEND_STATE,
  ROPE_EXTEND_TIMER,
  ROPE_COLUMN_VRAM_PTR,
  ROPE_CELL_COLUMN_TABLE,
  ROPE_CELL_TIMERS,
  TAMPER_STRIKES_ROM,
} from "./names.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
/**
 * addRopeSegmentAndAdvanceExtendState — rope-extend state machine, state 0: append one rope segment.
 *
 * WHAT IT IS
 *   The rope is the vertical line the enemies ride down toward the player. It does not appear all at
 *   once; it grows one segment at a time, and each segment is animated into place before the next is
 *   started. That growth is a tiny two-state machine selected by ROPE_EXTEND_STATE (0x8f14): state 0
 *   (this routine) *appends* a segment and hands off to state 1, and state 1 plays out the grow blit
 *   over several frames and then hands back to state 0 for the next segment.
 *
 * ROLE IN THE MACHINE
 *   Reached once per rope-extend tick while the rope is still growing. It decides whether another
 *   segment is due, and if so it records the segment (bumps the counts), computes where on screen the
 *   new segment's column lives, primes that segment's per-cell animation timer, and flips the state
 *   machine into its animation phase. The number of segments the rope ends up with is set by the
 *   per-stage arrival counter, so the rope length tracks how far the current wave has progressed.
 *
 * ROM ADDRESS: 0x2d80-0x2db7.
 * GROUNDING: [seen].
 *
 * LIVE-OUT (memory only; nothing is read back from a register):
 *   ROPE_SEGMENT_COUNT (0x8931)     — counted total, incremented
 *   ROPE_EXTEND_INDEX  (0x8f18)     — segment index, advanced
 *   ROPE_COLUMN_VRAM_PTR (0x8f19)   — 16-bit video-RAM column base for the new segment
 *   ROPE_CELL_TIMERS   (0x8f28 bank)— this segment's cell timer, reloaded
 *   ROPE_EXTEND_STATE  (0x8f14)     — advanced to the animation state (1)
 *   ROPE_EXTEND_TIMER  (0x8f16)     — sub-timer, armed
 */

const VIDEO_PAGE = 0x84; // high byte of every rope-column video-RAM address (the tile plane's page)
const SEGMENT_LIMIT = 0x04; // segment index below which the extend runs ungated
const RELOAD = 0x10; // reload value shared by the per-segment cell timer and the extend sub-timer

export function addRopeSegmentAndAdvanceExtendState(m) {
  const { mem8, mem16 } = m;

  // Terminating test: is the rope already at its full per-stage length?
  //   WAVE_ARRIVAL_COUNTER (0x8903) counts up as the current eagle wave arrives; two below that value
  //   is the rope's target segment count for this stage. Once ROPE_SEGMENT_COUNT (0x8931) has reached
  //   it, the rope is complete — do nothing and leave the state machine parked in state 0.
  if (u8(mem8[WAVE_ARRIVAL_COUNTER] - 2) === mem8[ROPE_SEGMENT_COUNT]) return;
  // A segment is due: record it by bumping the counted total at ROPE_SEGMENT_COUNT (0x8931).
  mem8[ROPE_SEGMENT_COUNT] = u8(mem8[ROPE_SEGMENT_COUNT] + 1);

  // Choose the column-table index for this segment.
  //   Normal growth is capped at SEGMENT_LIMIT (4) columns: while ROPE_EXTEND_INDEX (0x8f18) is below
  //   the limit the index itself indexes the column table. At or beyond the limit the extend is only
  //   allowed to continue when the anti-tamper strike counter TAMPER_STRIKES_ROM (0x89ef) is set — and
  //   in that case the strike value stands in as the table index. With no pending strike the rope has
  //   reached its normal length, so return without advancing.
  const index = mem8[ROPE_EXTEND_INDEX];
  let tableIndex = index;
  if (index >= SEGMENT_LIMIT) {
    const tamper = mem8[TAMPER_STRIKES_ROM];
    if (tamper === 0) return;
    tableIndex = tamper;
  }
  // Advance the segment index at ROPE_EXTEND_INDEX (0x8f18) to point at the newly added segment.
  mem8[ROPE_EXTEND_INDEX] = u8(index + 1);

  // Place the new segment's column on screen.
  //   ROPE_CELL_COLUMN_TABLE (0x2db8) is a small ROM table mapping a segment index to the low byte of
  //   its video-RAM column address. Pair that low byte with the fixed tile-plane page VIDEO_PAGE (0x84)
  //   to form the full 16-bit column base and stash it at ROPE_COLUMN_VRAM_PTR (0x8f19), where the
  //   animation state will blit this segment's tiles.
  const columnLo = fetchByteFromTableIndex(m, ROPE_CELL_COLUMN_TABLE, tableIndex)[0];
  mem16[ROPE_COLUMN_VRAM_PTR] = (VIDEO_PAGE << 8) | columnLo;

  // Prime this segment's per-cell animation timer.
  //   ROPE_CELL_TIMERS (0x8f28) is a four-entry, stride-2 bank of per-cell frame timers. The just-added
  //   segment is the (segment)th, so its timer lives at offset 2*(segment-1); load it with RELOAD (0x10)
  //   so the cell handlers begin counting this segment down from a full interval.
  const segment = mem8[ROPE_EXTEND_INDEX];
  mem8[ROPE_CELL_TIMERS + 2 * (segment - 1)] = RELOAD;

  // Hand off to the animation phase: advance ROPE_EXTEND_STATE (0x8f14) to state 1, which plays out the
  // segment's grow blit over several frames before returning the machine here for the next segment.
  mem8[ROPE_EXTEND_STATE] = u8(mem8[ROPE_EXTEND_STATE] + 1); // advance the rope sub-state
  // Arm the extend sub-timer ROPE_EXTEND_TIMER (0x8f16) with RELOAD (0x10) so the animation phase has a
  // full countdown to run before its first frame step.
  mem8[ROPE_EXTEND_TIMER] = RELOAD; // arm the sub-timer
}
