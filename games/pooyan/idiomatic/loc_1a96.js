// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundRun1D } from "./queueSoundRun1D.js";
import { loc_1ab2 } from "./loc_1ab2.js";
import { PLAY_STATE_INDEX, ACTIVE_PLAYER, HIGH_SCORE_INSERT_RANK, ROPE_SEGMENT_COUNT, MARKER_LAYOUT_PTR } from "./names.js";
/**
 * loc_1a96 — phase-exhausted handler, reached when the phase count drains to zero.
 *
 * Queues the phase-exhausted tile run, then advances the play sub-state index once more for the
 * active player when it is player one (its select cell non-zero) and once unconditionally, clears
 * the high-score insert rank and two round cells, and tail-hands to the high-score insert-sort.
 *
 * LIVE-OUT: memory only. Every consumed result is a work-RAM cell.
 */

export function loc_1a96(m) {
  const { mem8 } = m;

  queueSoundRun1D(m);

  if (mem8[ACTIVE_PLAYER] !== 0) mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1; // player one: extra step
  mem8[PLAY_STATE_INDEX] = (mem8[PLAY_STATE_INDEX] + 1);

  mem8[HIGH_SCORE_INSERT_RANK] = 0x00;
  mem8[ROPE_SEGMENT_COUNT] = 0x00;
  mem8[MARKER_LAYOUT_PTR] = 0x00;

  return loc_1ab2(m);
}
