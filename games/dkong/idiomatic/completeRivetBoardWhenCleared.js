// SPDX-License-Identifier: GPL-3.0-only
/**
 * completeRivetBoardWhenCleared — the rivet-board arm of Mario's per-frame position check: while
 * rivets remain, carry on (true); on the frame the last rivet is gone, hand off to the
 * board-advance step, which commits the board-cleared sub-state and unwinds (false).
 *
 * LIVE-OUT: the caller-skip signal, plus whatever the board-advance step writes.
 */

import { RIVETS_LEFT } from "./names.js";
import { enterBoardAdvanceAndUnwind } from "./enterBoardAdvanceAndUnwind.js";

export function completeRivetBoardWhenCleared(m) {
  const { mem8 } = m;

  if (mem8[RIVETS_LEFT] !== 0) return true;

  return enterBoardAdvanceAndUnwind(m);
}
