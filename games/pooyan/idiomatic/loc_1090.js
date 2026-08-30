// SPDX-License-Identifier: GPL-3.0-only
import {
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  BONUS_STAGE_TALLY_DISPLAY_CMD,
} from "./names.js";
import { loc_0038 } from "./loc_0038.js";

/**
 * loc_1090 — a main-loop sub-state handler running a frame-delay countdown.
 *
 * While the field-1 counter is still non-zero it ticks it down one and bails. When the counter
 * has reached zero it advances the main-loop sub-state selector and enqueues the bonus-stage
 * tally display command into the display ring.
 *
 * LIVE-OUT: memory only — the decremented counter, or the incremented selector plus the enqueued
 * command. No register output.
 */

export function loc_1090(m) {
  const { mem8 } = m;

  if (mem8[SUBSTATE_FIELD1_COUNTER] !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] -= 1; // still counting — tick the delay down and bail
    return;
  }

  mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1; // counter expired — advance the sub-state selector
  loc_0038(m, BONUS_STAGE_TALLY_DISPLAY_CMD); // enqueue the bonus-stage tally display command
}
