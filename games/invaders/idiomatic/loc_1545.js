// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { deactivatePrize } from "./deactivatePrize.js";

// Set the player-shot status to 4, then deactivate the prize; value-out A.
export function loc_1545(m) {
  m.mem8[PLAYER_SHOT_STATUS] = 0x04;
  return deactivatePrize(m);
}
