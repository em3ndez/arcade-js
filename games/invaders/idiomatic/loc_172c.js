// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { startSound } from "./startSound.js";
import { loc_19dc } from "./loc_19dc.js";

// Gate the port-3 sound bit on PLAYER_SHOT_STATUS: raise it when nonzero, else mask it off.
export function loc_172c(m) {
  if (m.mem8[PLAYER_SHOT_STATUS] !== 0) return startSound(m, 0x02);
  return loc_19dc(m, 0xfd);
}
