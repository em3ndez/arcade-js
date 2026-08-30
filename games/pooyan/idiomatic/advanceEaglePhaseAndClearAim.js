// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_AIM_FLAGS, LATCHED_ENEMY_X, WAVE_RECORDS_ARRIVED } from "./names.js";
/**
 * advanceEaglePhaseAndClearAim — the reset epilogue that closes one eagle-wave phase and
 * opens the next.
 *
 * ROM: 0x7292-0x729f. Grounding: [seen].
 *
 * ROLE. The eagle (the bonus/eagle wave) runs through a small sequence of outer phases,
 * tracked by a phase counter at 0x8f38, with a per-phase sub-count of arrived records
 * directly below it at WAVE_RECORDS_ARRIVED (0x8f39). This routine is the tail reached
 * when a phase finishes: it tears down the state left over from the phase just ended,
 * steps the outer phase forward one, and zeroes the sub-count so the incoming phase
 * starts from a clean slate.
 *
 * The teardown clears two things the ended phase left set: the player aim-indicator flags
 * (PLAYER_AIM_FLAGS, 0x8a87 — the on-screen aim indicator's mode/direction latch) and the
 * latched enemy X (LATCHED_ENEMY_X, 0x8f5b — the last enemy horizontal position the aim
 * logic captured). Both go to 0 so no stale aim carries into the next phase.
 *
 * The phase counter lives one cell below the records-arrived count, so EAGLE_WAVE_PHASE is
 * addressed as WAVE_RECORDS_ARRIVED - 1 (0x8f38). It is incremented (the phase advances by
 * exactly one), and then the adjacent sub-count is cleared.
 *
 * LIVE-OUT: memory only — PLAYER_AIM_FLAGS, LATCHED_ENEMY_X, the incremented phase counter,
 * and the cleared records-arrived count. (The ROM leaves A = 0 here as a byproduct, but no
 * caller reads it; this is purely a reset epilogue.)
 */
// The eagle-wave outer-phase counter sits one cell below the records-arrived sub-count.
const EAGLE_WAVE_PHASE = WAVE_RECORDS_ARRIVED - 1; // 0x8f38

export function advanceEaglePhaseAndClearAim(m) {
  const { mem8 } = m;

  // Clear the aim-indicator latch and the last-captured enemy X so no stale aim state
  // from the phase just ended leaks into the next one.
  mem8[PLAYER_AIM_FLAGS] = 0;
  mem8[LATCHED_ENEMY_X] = 0;

  // Step the eagle-wave outer phase forward by one.
  mem8[EAGLE_WAVE_PHASE] = mem8[EAGLE_WAVE_PHASE] + 1;

  // Reset the per-phase records-arrived sub-count so the incoming phase starts fresh.
  mem8[WAVE_RECORDS_ARRIVED] = 0;
}
