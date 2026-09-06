// SPDX-License-Identifier: GPL-3.0-only
// Phase-counter tick for a gated square-wave tone: until the counter is one step from expiry, drive the
// tone toggler each tick; at the expiry step, park the counter at 0 and re-arm the tone duration to 8.
import { driveGatedSquareTone } from "./driveGatedSquareTone.js";
import { loc_41cc, SOUND_TONE_DURATION } from "./names.js";

const REARM_DURATION = 8;

export function advanceGatedSquareTone(m) {
  const { mem8 } = m;

  // More than one step from expiry: keep driving the tone. (No store back to the counter here.)
  if (((mem8[loc_41cc] - 1) & 0xff) !== 0) {
    driveGatedSquareTone(m);
    return;
  }

  // Expiry step: park the counter at 0 and re-arm the duration.
  mem8[loc_41cc] = 0;
  mem8[SOUND_TONE_DURATION] = REARM_DURATION;
}
