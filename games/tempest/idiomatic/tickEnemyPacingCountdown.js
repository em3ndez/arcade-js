// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER, loc_3d, ACTIVE_SLOT_COUNT, LEVEL_ID, PLAYER_LEVEL_TBL, SLOT_COUNTDOWN, SLOT_COUNTDOWN_HI } from "./names.js";
import { reloadPacingFromPeakSlot } from "./reloadPacingFromPeakSlot.js";

// Tick the active slot's countdown; when both gate bytes are spent, finalize.
// Otherwise pick the next non-empty slot via the toggle and arm its timers.
export function tickEnemyPacingCountdown(m) {
  const { mem8 } = m;
  mem8[MODE_DELAY_TIMER] = 0;
  let x = mem8[loc_3d];
  const cur = u8(SLOT_COUNTDOWN + x);
  mem8[cur] = mem8[cur] - 1;
  if ((mem8[SLOT_COUNTDOWN] | mem8[SLOT_COUNTDOWN_HI]) === 0) {
    reloadPacingFromPeakSlot(m);
    return;
  }
  x = mem8[loc_3d];
  if (mem8[u8(SLOT_COUNTDOWN + x)] === 0) {
    mem8[MODE_DISPATCH_SEL] = 0x0c;
    mem8[MODE_DELAY_TIMER] = 0x28;
  }
  for (;;) {
    if (mem8[ACTIVE_SLOT_COUNT] !== 0) mem8[LEVEL_ID] ^= 0x01;
    x = mem8[LEVEL_ID];
    if (mem8[u8(SLOT_COUNTDOWN + x)] !== 0) break;
  }
  const y = u8(mem8[u8(PLAYER_LEVEL_TBL + x)] + 1);
  mem8[GAME_MODE_PENDING] = y === 0 ? 0x1c : 0x02;
  mem8[GAME_MODE] = 0x0a;
}
