// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundRun1D } from "./queueSoundRun1D.js";
import { insertScoreIntoHighScoreTable } from "./insertScoreIntoHighScoreTable.js";
import { PLAY_STATE_INDEX, ACTIVE_PLAYER, HIGH_SCORE_INSERT_RANK, ROPE_SEGMENT_COUNT, MARKER_LAYOUT_PTR } from "./names.js";
/**
 * advancePlayStateThenInsertHighScore -- the phase-exhausted handler.
 *
 * WHAT IT IS
 *   ROM 0x1a96-0x1ab1. The one-shot that fires the instant a round runs out of phases.
 *
 * ROLE IN THE MACHINE
 *   A play frame dispatches twice: MAIN_GAME_STATE (0x8805) selects the "play" branch,
 *   which in turn dispatches on the in-play sub-state index PLAY_STATE_INDEX (0x880a).
 *   Sub-state 7 is the phase-gauge drain (advancePhaseGaugeCountdown): each phase it counts
 *   the visible five-cell HUD gauge GAUGE_PHASE_COUNTER (0x8908) down by one. When that
 *   counter reaches zero the gauge drain tails straight into THIS routine. So this is the
 *   moment a round's playable portion ends -- the gauge is empty -- and the machine turns
 *   toward round teardown and, ultimately, high-score entry.
 *
 * WHAT IT DOES
 *   Queues the phase-exhausted sound run, steps the sub-state index forward into the
 *   teardown range (one step, plus a second step when the second player is the active one),
 *   zeroes the three round cells that must not survive into teardown, and tails into the
 *   high-score insert-sort.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. It advances PLAY_STATE_INDEX (0x880a), clears HIGH_SCORE_INSERT_RANK
 *   (0x89fc), ROPE_SEGMENT_COUNT (0x8931) and MARKER_LAYOUT_PTR (0x8932), and leaves the rest
 *   of the work to insertScoreIntoHighScoreTable. No value is returned to a caller for use.
 */

export function advancePlayStateThenInsertHighScore(m) {
  const { mem8 } = m;

  // Announce the phase's end audibly: queue the phase-exhausted sound-command run, whose
  // fixed lead byte is 0x1d, onto the sound-command ring for the audio processor (ROM 0x0f92).
  queueSoundRun1D(m);

  // Step the in-play sub-state index PLAY_STATE_INDEX (0x880a) forward out of the gauge-drain
  // phase and into the round-teardown indices. The advance is player-dependent: it always
  // moves one step, and moves a second step when ACTIVE_PLAYER (0x880d) is nonzero -- i.e.
  // the second player is the one currently in play. The two players therefore land on adjacent
  // but distinct teardown sub-states so their per-player banks are torn down independently.
  // (ROM: A = (0x880d); AND A; the extra inc happens only on the nonzero -- second-player -- path.)
  if (mem8[ACTIVE_PLAYER] !== 0) mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1; // second player: extra step
  // The unconditional step taken by both players (ROM inc (0x880a)).
  mem8[PLAY_STATE_INDEX] = (mem8[PLAY_STATE_INDEX] + 1);

  // Zero the three round cells that must start clean for the teardown / high-score entry that
  // follows. The ROM clears A (xor a) once and stores it into each in turn:
  //   HIGH_SCORE_INSERT_RANK (0x89fc) -- the "winning rank + 1" latch; cleared so the insert-sort
  //     below begins with no rank claimed until it finds where this score belongs.
  mem8[HIGH_SCORE_INSERT_RANK] = 0x00;
  //   ROPE_SEGMENT_COUNT (0x8931) -- the count of extended rope segments; the round's rope is
  //     gone once the gauge empties, so its segment count is reset to none.
  mem8[ROPE_SEGMENT_COUNT] = 0x00;
  //   MARKER_LAYOUT_PTR (0x8932) -- the saved round-marker layout pointer word; cleared for teardown.
  mem8[MARKER_LAYOUT_PTR] = 0x00;

  // Tail into the high-score insert-sort (ROM 0x1ab2): fold the active player's finished score
  // into the sorted 10-entry high-score table and its parallel play-time / display-tile
  // side-tables. Control does not come back here afterward.
  return insertScoreIntoHighScoreTable(m);
}
