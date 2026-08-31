// SPDX-License-Identifier: GPL-3.0-only
import {
  PLAY_MODE_LATCH,
  loc_89e3,
  GAME_ACTIVE_FLAG,
  GAUGE_PHASE_COUNTER,
  PLAY_STATE_INDEX,
  ACTIVE_PLAYER,
} from "./names.js";
import { reseedSpawnCountersAndArmPlayMode } from "./reseedSpawnCountersAndArmPlayMode.js";
import { queueSoundCommands82And95 } from "./queueSoundCommands82And95.js";
import { resetBoardRamAndReseedSpawnCounters } from "./resetBoardRamAndReseedSpawnCounters.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { advancePlayStateThenInsertHighScore } from "./advancePlayStateThenInsertHighScore.js";
import { resetGameToAttractState } from "./resetGameToAttractState.js";
/**
 * advancePhaseGaugeCountdown — gameplay-state entry. While the play-mode latch is set it tails to the gameplay-state
 * handler; otherwise it runs the reset pair, clears the gauge-reset cell, and (credit gate open)
 * counts the gauge phase down. On zero or an already-zero count it tails to the phase-exhausted
 * handler; else it renders the gauge and seeds the play sub-state (one higher for player one).
 * A closed credit gate tears down.
 *
 * LIVE-OUT: memory only — no register survives for a caller.
 */

export function advancePhaseGaugeCountdown(m) {
  const { mem8 } = m;

  if (mem8[PLAY_MODE_LATCH] !== 0) return reseedSpawnCountersAndArmPlayMode(m); // latch set

  queueSoundCommands82And95(m);
  resetBoardRamAndReseedSpawnCounters(m);
  mem8[loc_89e3] = 0x00;

  if (mem8[GAME_ACTIVE_FLAG] === 0) return resetGameToAttractState(m); // credit gate closed

  if (mem8[GAUGE_PHASE_COUNTER] === 0) return advancePlayStateThenInsertHighScore(m); // count already 0
  mem8[GAUGE_PHASE_COUNTER] = mem8[GAUGE_PHASE_COUNTER] - 1;
  if (mem8[GAUGE_PHASE_COUNTER] === 0) return advancePlayStateThenInsertHighScore(m); // count reached 0

  renderPhaseGauge(m);
  mem8[PLAY_STATE_INDEX] = mem8[ACTIVE_PLAYER] !== 0 ? 0x0b : 0x0a;
}
