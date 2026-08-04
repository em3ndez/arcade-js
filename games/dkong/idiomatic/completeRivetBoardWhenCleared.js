// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeRivetBoardWhenCleared — on the rivet board, complete the board the frame
 * its last rivet is gone.
 *
 * The rivet-board arm of Mario's per-frame position check, reached only while the
 * rivet board is the one being played. It reads how many rivets are still in place:
 * while any remain the board is not won, so it reports "carry on" and the movement
 * cascade continues normally. On the frame the count reaches zero the board is won,
 * and it hands off to the board-advance step, which commits the board-cleared
 * sub-state and unwinds out of the cascade.
 *
 * The return value is the caller-skip signal threaded through this whole position
 * check:
 *   true  — normal: the board is not complete, so the caller proceeds.
 *   false — the board was won and the cascade unwound, so the caller must NOT continue
 *           this frame.
 *
 * LIVE-OUT: the caller-skip signal, plus whatever the board-advance step writes. This
 * routine writes nothing of its own; the rivet count is only read.
 */

import { RIVETS_LEFT } from "./names.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js";

export function completeRivetBoardWhenCleared(m) {
  const { mem } = m;

  // Any rivets still in place — the board is not won yet; carry on normally.
  if (mem.read8(RIVETS_LEFT) !== 0) return true;

  // The last rivet is gone: commit the board-cleared/advance sub-state and unwind out
  // of the movement cascade (returns false — the caller must not continue this frame).
  return enterBoardAdvanceAndUnwind(m);
}
