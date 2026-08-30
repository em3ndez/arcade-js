// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import {
  SUBSTATE_FIELD1_COUNTER,
  MAINLOOP_SUBSTATE_SELECTOR,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";

/**
 * loc_113c — main-loop sub-state 4 handler (reached from the sub-state dispatch table).
 *
 * Ticks the sub-state countdown timer SUBSTATE_FIELD1_COUNTER. While it is non-zero: decrement it
 * and enqueue the display command HUNTER_SPAWN_DISPLAY_CMD into the page-0x88 ring. When it reaches
 * zero: reload the timer to COUNTER_RELOAD and bump MAINLOOP_SUBSTATE_SELECTOR, advancing the main
 * loop to the next sub-state.
 *
 * No register-bridge inputs; the display-ring enqueue helper is already idiomatic and called
 * directly.
 *
 * LIVE-OUT: memory only — the timer cell, the sub-state selector, and (counting branch) the
 * enqueued command bytes. Register outputs are idiomatic-only: this is a dispatch-table handler
 * whose caller reloads its registers, so no register side-effect is forced.
 */

const COUNTER_RELOAD = 0x80; // value the expired timer is reseeded to

export function loc_113c(m) {
  const { mem8 } = m;

  const timer = mem8[SUBSTATE_FIELD1_COUNTER];
  if (timer === 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = COUNTER_RELOAD;
    mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1;
    return;
  }

  mem8[SUBSTATE_FIELD1_COUNTER] = timer - 1;
  loc_0038(m, HUNTER_SPAWN_DISPLAY_CMD);
}
