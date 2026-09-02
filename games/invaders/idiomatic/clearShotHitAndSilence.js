// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_HIT } from "./names.js";
import { loc_19dc } from "./loc_19dc.js";

// Clear the shot-hit latch, then mask bit 3 (the invader-die sound) off the port-3 sound shadow; value-out A.
export function clearShotHitAndSilence(m) {
  m.mem8[PLAYER_SHOT_HIT] = 0;
  return loc_19dc(m, 0xf7);
}
