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
 * advancePhaseGaugeCountdown
 * ==========================
 * WHAT IT IS
 *   The play sub-state handler for index 7, "drain the phase gauge". During a round the machine runs
 *   a small state machine keyed on PLAY_STATE_INDEX (0x880a); this is the handler seated when the
 *   round has reached the phase-gauge phase. The phase gauge is the visible HUD meter driven by
 *   GAUGE_PHASE_COUNTER (0x8908): each time this handler runs on the gauge phase it ticks that counter
 *   down by one and repaints the meter, and when the counter empties the round moves on.
 *
 * ROLE IN THE MACHINE
 *   Sits inside the in-play sub-state dispatch. It has three shapes:
 *     - Play-mode latch set: active play is running, so it hands straight off to the gameplay-state
 *       handler and does no gauge work.
 *     - Latch clear, credit gate open: it runs the per-entry reset pair, clears the once-per-round
 *       cell, then counts the gauge down one step — repainting the meter and re-seating the sub-state
 *       while the gauge still has counts left, or handing off to the phase-exhausted handler once it
 *       empties.
 *     - Latch clear, credit gate closed: no game is in progress, so it tears the machine back down to
 *       the attract state.
 *
 * ROM ADDRESS: 0x1a64-0x1a95
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only — no register survives for a caller. It may leave GAUGE_PHASE_COUNTER (0x8908)
 *   decremented, loc_89e3 (0x89e3) cleared, and PLAY_STATE_INDEX (0x880a) re-seated (0x0a / 0x0b),
 *   or it may divert entirely into one of the handoff handlers.
 */

export function advancePhaseGaugeCountdown(m) {
  const { mem8 } = m;

  // Fast path — active play. The play-mode latch PLAY_MODE_LATCH (0x8f50) is raised while a round is
  // actually being played out; when it is set the gauge-drain phase is not what is running, so hand
  // straight off to the gameplay-state handler (0x1a01) and do none of the gauge bookkeeping below.
  if (mem8[PLAY_MODE_LATCH] !== 0) return reseedSpawnCountersAndArmPlayMode(m); // latch set

  // Per-entry reset pair. With the latch clear we are entering the gauge phase fresh, so re-prime the
  // board and sound:
  //   - queueSoundCommands82And95 (0x0f4e) enqueues the two fixed sound commands 0x82 and 0x95.
  //   - resetBoardRamAndReseedSpawnCounters (0x2527) does the board/HUD reset: enqueues a display
  //     command, conditionally reseeds the spawn-phase / rope-draw counters, and clears the actor/HUD
  //     RAM blocks.
  // Then clear loc_89e3 (0x89e3), the once-per-round gauge-reset cell, back to 0 so the round's
  // once-per-round work can arm again.
  queueSoundCommands82And95(m);
  resetBoardRamAndReseedSpawnCounters(m);
  mem8[loc_89e3] = 0x00;

  // Credit gate. GAME_ACTIVE_FLAG (0x8806) is nonzero only while a paid game is in progress. If it is
  // clear there is nothing to keep alive, so tear the machine back down to the attract state via
  // resetGameToAttractState (0x1d3c).
  if (mem8[GAME_ACTIVE_FLAG] === 0) return resetGameToAttractState(m); // credit gate closed

  // Gauge countdown. GAUGE_PHASE_COUNTER (0x8908) is the phase-gauge meter's remaining count. If it is
  // already at 0 the gauge is spent, so hand off to the phase-exhausted handler
  // advancePlayStateThenInsertHighScore (0x1a96) without touching it further. Otherwise tick it down
  // by one; if that decrement is what brings it to 0, the gauge has just emptied on this frame and we
  // hand off to the same phase-exhausted handler.
  if (mem8[GAUGE_PHASE_COUNTER] === 0) return advancePlayStateThenInsertHighScore(m); // count already 0
  mem8[GAUGE_PHASE_COUNTER] = mem8[GAUGE_PHASE_COUNTER] - 1;
  if (mem8[GAUGE_PHASE_COUNTER] === 0) return advancePlayStateThenInsertHighScore(m); // count reached 0

  // Still draining. The gauge has counts left, so repaint the vertical HUD meter from the new counter
  // value via renderPhaseGauge (0x03c2), then re-seat the play sub-state PLAY_STATE_INDEX (0x880a) so
  // the gauge phase runs again next time: 0x0a for player one's turn, 0x0b for player two — one higher
  // when ACTIVE_PLAYER (0x880d) is nonzero (the second player).
  renderPhaseGauge(m);
  mem8[PLAY_STATE_INDEX] = mem8[ACTIVE_PLAYER] !== 0 ? 0x0b : 0x0a;
}
