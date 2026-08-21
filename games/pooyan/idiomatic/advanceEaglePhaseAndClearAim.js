// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_AIM_FLAGS, LATCHED_ENEMY_X, WAVE_RECORDS_ARRIVED } from "./names.js";
/**
 * advanceEaglePhaseAndClearAim — end-of-phase reset for the bonus/eagle wave.
 *
 * Drops the player aim-indicator flags and the latched enemy X, advances the eagle-wave outer
 * phase one step, and clears the records-arrived sub-count so the next phase starts fresh.
 *
 * LIVE-OUT: memory only. Leaves A = 0, but no caller reads it — this is a reset epilogue.
 */
// The eagle-wave outer-phase selector sits one cell below the records-arrived count.
const EAGLE_WAVE_PHASE = WAVE_RECORDS_ARRIVED - 1;

export function advanceEaglePhaseAndClearAim(m) {
  const { mem8 } = m;

  mem8[PLAYER_AIM_FLAGS] = 0;
  mem8[LATCHED_ENEMY_X] = 0;
  mem8[EAGLE_WAVE_PHASE] = mem8[EAGLE_WAVE_PHASE] + 1;
  mem8[WAVE_RECORDS_ARRIVED] = 0;
}
