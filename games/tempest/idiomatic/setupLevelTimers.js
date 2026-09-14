// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER, STATUS_FLAGS, loc_3d, LEVEL_ID, PLAYER_LEVEL_TBL, loc_9f, loc_117,
} from "./names.js";
import { swapParallelTables } from "./swapParallelTables.js";
import { selectProjectionScale } from "./selectProjectionScale.js";
import { loc_9025 } from "./loc_9025.js";
import { resetBothPokeyChips } from "./resetBothPokeyChips.js";

// Level-setup: seed the sizing/timer cells, and when the level id LEVEL_ID has changed
// since last seen (loc_3d) and STATUS_FLAGS is negative, install the new-level timers and swap
// the paired tables. Then converge: run the flag setup, index PLAYER_LEVEL_TBL by loc_3d into loc_9f,
// run startup init, and tail-delegate to the readout reset.
export function setupLevelTimers(m) {
  const { mem8 } = m;

  mem8[MODE_DISPATCH_SEL] = 0;
  mem8[GAME_MODE] = 30;
  mem8[GAME_MODE_PENDING] = 30;

  const level = mem8[LEVEL_ID];
  if (level !== mem8[loc_3d]) {
    mem8[loc_3d] = level;
    if (mem8[STATUS_FLAGS] & 0x80) {
      mem8[MODE_DISPATCH_SEL] = 14;
      mem8[GAME_MODE] = 10;
      mem8[MODE_DELAY_TIMER] = mem8[loc_117] !== 0 ? 40 : 80;
      swapParallelTables(m);
    }
  }

  selectProjectionScale(m);
  mem8[loc_9f] = mem8[u8(PLAYER_LEVEL_TBL + mem8[loc_3d])];
  loc_9025(m);
  return resetBothPokeyChips(m);
}
