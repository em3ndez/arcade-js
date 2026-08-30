// SPDX-License-Identifier: GPL-3.0-only
import { loc_50f1 } from "./loc_50f1.js";
import { queueSoundRun28 } from "./queueSoundRun28.js";
import { loc_1016 } from "./loc_1016.js";
import {
  STAGE_COUNTDOWN,
  ROUND_COUNTER,
  HUNTER_SPAWN_FLIP_FLAG,
  LAUNCH_ARMED_FLAG,
  MAINLOOP_SUBSTATE_SELECTOR,
  TAMPER_STRIKES_SIG,
} from "./names.js";

/**
 * loc_0fef — the sub-state-0 main-loop handler: reset the frame, then either idle or run a frame.
 *
 * Reloads the stage countdown, runs the integrity walker when the round counter's bit 2 is set,
 * re-arms the three per-frame latches, and enqueues the frame-setup sound run. Then it reads the
 * pending sub-state byte: zero means nothing scheduled (return); otherwise it latches that value
 * as the selector and runs the ten-step per-frame worker chain.
 *
 * LIVE-OUT: memory only — the countdown, the three latches, the selector, plus every effect of the
 * walker / sound enqueue / worker chain. No register output.
 */

const STAGE_RELOAD = 0x0f;
const ROUND_BIT2 = 0x04;

export function loc_0fef(m) {
  const { mem8 } = m;

  mem8[STAGE_COUNTDOWN] = STAGE_RELOAD;
  if (mem8[ROUND_COUNTER] & ROUND_BIT2) loc_50f1(m);

  // Re-arm the per-frame latches, then run the frame-setup sound enqueue.
  mem8[HUNTER_SPAWN_FLIP_FLAG] = 1;
  mem8[LAUNCH_ARMED_FLAG] = 1;
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = 1;
  queueSoundRun28(m);

  // No pending sub-state -> idle; otherwise latch it and run one frame's worker chain.
  const pending = mem8[TAMPER_STRIKES_SIG];
  if (pending === 0) return;
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = pending;
  loc_1016(m);
}
