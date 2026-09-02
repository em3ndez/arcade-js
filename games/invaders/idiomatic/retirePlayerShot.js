// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { clearShotHitAndSilence } from "./clearShotHitAndSilence.js";

// Set the player-shot status to 4 (retiring), then clear the hit latch + silence the explosion sound; value-out A.
export function retirePlayerShot(m) {
  m.mem8[PLAYER_SHOT_STATUS] = 0x04;
  return clearShotHitAndSilence(m);
}
