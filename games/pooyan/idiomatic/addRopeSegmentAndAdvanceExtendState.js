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
 * addRopeSegmentAndAdvanceExtendState — rope-extend driver (sub-state 0): add one rope segment.
 *
 * Returns at once when the rope has already grown to two below the stage's arrival count.
 * Otherwise it bumps the segment count and, while the segment index is below four (or a
 * tamper strike is pending), advances that index, looks this segment's video-column base up
 * from the column table and stores it, reloads the segment's cell timer, advances the rope
 * sub-state, and arms the sub-timer.
 *
 * LIVE-OUT: memory only. Dispatched as a per-frame state handler that rets to the state
 * loop; no caller reads a register back.
 */

const VIDEO_PAGE = 0x84; // high byte of the rope column's video address
const SEGMENT_LIMIT = 0x04; // index below which the extend runs ungated
const RELOAD = 0x10; // cell-timer / sub-timer reload value

export function addRopeSegmentAndAdvanceExtendState(m) {
  const { mem8, mem16 } = m;

  // stop once the rope has reached its per-stage length
  if (u8(mem8[WAVE_ARRIVAL_COUNTER] - 2) === mem8[ROPE_SEGMENT_COUNT]) return;
  mem8[ROPE_SEGMENT_COUNT] = u8(mem8[ROPE_SEGMENT_COUNT] + 1);

  // below the limit the extend runs freely; at or above it needs a pending tamper strike
  const index = mem8[ROPE_EXTEND_INDEX];
  let tableIndex = index;
  if (index >= SEGMENT_LIMIT) {
    const tamper = mem8[TAMPER_STRIKES_ROM];
    if (tamper === 0) return;
    tableIndex = tamper;
  }
  mem8[ROPE_EXTEND_INDEX] = u8(index + 1);

  // this segment's video-RAM column base: low byte from the column table, page fixed
  const columnLo = fetchByteFromTableIndex(m, ROPE_CELL_COLUMN_TABLE, tableIndex)[0];
  mem16[ROPE_COLUMN_VRAM_PTR] = (VIDEO_PAGE << 8) | columnLo;

  // reload the just-added segment's cell timer (one cell-pair per counted segment)
  const segment = mem8[ROPE_EXTEND_INDEX];
  mem8[ROPE_CELL_TIMERS + 2 * (segment - 1)] = RELOAD;

  mem8[ROPE_EXTEND_STATE] = u8(mem8[ROPE_EXTEND_STATE] + 1); // advance the rope sub-state
  mem8[ROPE_EXTEND_TIMER] = RELOAD; // arm the sub-timer
}
