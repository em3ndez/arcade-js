// SPDX-License-Identifier: GPL-3.0-only
import { clearAimIndicatorUnlessProximityHit } from "./clearAimIndicatorUnlessProximityHit.js";
import { AIM_INDICATOR_MODE, AIM_INDICATOR_TIMER, PLAYER_AIM_FLAGS } from "./names.js";

/**
 * driveAimIndicatorHitTimerElseRescan — step the aim indicator selected by AIM_INDICATOR_MODE.
 *
 * Mode 0 runs the proximity redraw pass. Mode 1 lights the "above" bit and any
 * higher mode the "below" bit of PLAYER_AIM_FLAGS (each clearing the other), then drains
 * AIM_INDICATOR_TIMER; when it reaches zero the mode byte is cleared, ending the sequence.
 *
 * LIVE-OUT: none — the sole caller re-reads memory afterward, not a register.
 */

const AIM_ABOVE = 0x04; // PLAYER_AIM_FLAGS bit2
const AIM_BELOW = 0x08; // PLAYER_AIM_FLAGS bit3

export function driveAimIndicatorHitTimerElseRescan(m) {
  const { mem8 } = m;
  const mode = mem8[AIM_INDICATOR_MODE];

  if (mode === 0) {
    clearAimIndicatorUnlessProximityHit(m); // proximity redraw pass
    return;
  }

  if (mode === 1) {
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW;
  } else {
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE;
  }

  mem8[AIM_INDICATOR_TIMER] = mem8[AIM_INDICATOR_TIMER] - 1;
  if (mem8[AIM_INDICATOR_TIMER] !== 0) return;
  mem8[AIM_INDICATOR_MODE] = 0x00;
}
