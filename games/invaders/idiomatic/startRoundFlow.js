// SPDX-License-Identifier: GPL-3.0-only
import { showRoundStartSplash } from "./showRoundStartSplash.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { restoreShieldsAndEnterRound } from "./restoreShieldsAndEnterRound.js";
import { TASK_FLAGS } from "./names.js";

// Round-start entry: run the round-start splash delay, clear the play-field, drop TASK_FLAGS, then fall
// into the shield/field preamble. Generator; memory + IO.
export function* startRoundFlow(m) {
  yield* showRoundStartSplash(m);
  clearPlayfield(m);
  m.mem8[TASK_FLAGS] = 0x00;
  yield* restoreShieldsAndEnterRound(m);
}
