// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerMarioFall — raise the one-shot "start falling" trigger when the ground
 * under Mario went away. The player-state reset consumes and clears it next frame,
 * launching the fall with zero initial velocity.
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL.
 */

import { MARIO_START_FALL } from "./names.js";

export function triggerMarioFall(m) {
  const { mem8 } = m;

  mem8[MARIO_START_FALL] = 1;
}
