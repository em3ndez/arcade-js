// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, loc_3d, PLAYER_LEVEL_TBL, loc_9f, loc_102 } from "./names.js";
import { seatInPagePointer } from "./seatInPagePointer.js";
import { addBcdScoreAndAwardAtThreshold } from "./addBcdScoreAndAwardAtThreshold.js";
import { loc_ccb9 } from "./loc_ccb9.js";
import { loc_9009 } from "./loc_9009.js";

// Index off loc_3d. Bump the PLAYER_LEVEL_TBL-slot (and loc_9f) while it is below 0x62, seed GAME_MODE = 0x18,
// and when the loc_102-slot is nonzero run its handler chain; then tail-delegate.
export function bumpLevelEnemyQuota(m) {
  const { mem8 } = m;

  const idx = mem8[loc_3d];
  const slot = (PLAYER_LEVEL_TBL + idx) & 0xff;
  const cur = mem8[slot];
  if (cur < 0x62) {
    mem8[slot] = cur + 1;
    mem8[loc_9f] = mem8[loc_9f] + 1;
  }

  mem8[GAME_MODE] = 0x18;

  const trigger = mem8[u16(loc_102 + idx)];
  if (trigger !== 0) {
    seatInPagePointer(m, trigger);
    addBcdScoreAndAwardAtThreshold(m, 0xff);
    loc_ccb9(m);
  }

  return loc_9009(m);
}
