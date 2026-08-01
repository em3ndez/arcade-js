// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeRivetBoardWhenCleared — on a rivet (100m) board, complete the board the
 * frame its last rivet is gone.  ROM 0x1E80.
 *
 * The rivet-board arm of Mario's per-frame position check (sub_1e57), reached only
 * when the current board is the rivet board. It reads how many rivets are still in
 * place: while any remain the board is not won, so it returns "keep going" and the
 * movement cascade continues normally. On the frame the count reaches zero the board
 * is won — it hands off to enterBoardAdvanceAndUnwind, which commits the board-
 * cleared/advance sub-state and unwinds out of the cascade.
 *
 * The return value is the caller-skip signal threaded through this whole position
 * check:
 *   true  — normal: the board is not complete, so the caller proceeds.
 *   false — the board was won and the cascade unwound, so the caller must NOT continue
 *           this frame (enterBoardAdvanceAndUnwind's unwind signal, passed straight
 *           through).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e80.test.js.
 * GATE:     exhaustive — the only input is the rivet count, and the behaviour
 *           partitions on zero vs non-zero, so all 256 values are swept on real
 *           attract RAM with a controlled return stack, plus a REALISM sweep. Attract
 *           only ever plays the girder board, so it dispatches this ZERO times; the
 *           won path is reached by the rivet-count-zero crafted value, identically on
 *           both sides. Teeth: dropped-write, wrong-substate, stray-pop, inverted-test
 *           and no-unwind twins, each caught.
 * LIVE-OUT: RIVETS_LEFT read + (on the won path) GAME_SUBSTATE := 0x16 in memory, plus
 *           the boolean caller-skip signal. No live registers/flags — every consumer
 *           reads only that memory and the unwind; the oracle's residual accumulator/
 *           flags and its return-stack churn are dead ABI.
 * NAMES:    RIVETS_LEFT (0x6290) from ram.js; GAME_SUBSTATE (0x600A) is written inside
 *           enterBoardAdvanceAndUnwind. The won-path sub-state code 0x16 lives in the
 *           callee.
 */

import { RIVETS_LEFT } from "./ram.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js"; // ROM 0x1E85

export function completeRivetBoardWhenCleared(m) {
  const { mem } = m;

  // Any rivets still in place — the board is not won yet; carry on normally.
  if (mem.read8(RIVETS_LEFT) !== 0) return true;

  // The last rivet is gone: commit the board-cleared/advance sub-state and unwind out
  // of the movement cascade (returns false — the caller must not continue this frame).
  return enterBoardAdvanceAndUnwind(m);
}
