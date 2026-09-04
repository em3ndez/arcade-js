// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { startSound } from "./startSound.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

// Gate the port-3 sound bit on PLAYER_SHOT_STATUS: raise it when nonzero, else mask it off.
export function updatePlayerShotSound(m) {
  if (m.mem8[PLAYER_SHOT_STATUS] !== 0) return startSound(m, 0x02);
  return clearSoundPort3Bit(m, 0xfd);
}
