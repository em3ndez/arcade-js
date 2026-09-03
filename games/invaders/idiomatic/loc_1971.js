// SPDX-License-Identifier: GPL-3.0-only
import { loc_0a59 } from "./loc_0a59.js";
import { resolvePlayerShotHit } from "./resolvePlayerShotHit.js";
import { startSound } from "./startSound.js";
import { clearGameActive } from "./clearGameActive.js";
import { clearScreenRegion } from "./clearScreenRegion.js";
import { drawLivesDigit } from "./drawLivesDigit.js";
import { loc_19dc } from "./loc_19dc.js";
import { gameOverFlow } from "./gameOverFlow.js";
import { loc_206d, loc_2015, RESERVE_SHIP_ICONS_SCREEN_ADDR } from "./names.js";

// The round-ending warm restart. Mark the reset in progress, re-enable interrupts, and clear the arm
// trigger; then hold each frame -- resolving any in-flight player shot and sounding the alarm -- until
// the interrupt-driven death animation raises the trigger. Once it does, drop the game-active flag,
// blank the reserve-ship readout region, zero the lives digit, silence the sound bit, and join the
// game-over flow. A generator armed as the successor frame flow, never run inside the interrupt body.
// Memory + IO.
export function* loc_1971(m) {
  m.mem8[loc_206d] = 0x01;
  m.io.setInte(true);
  m.mem8[loc_2015] = 0x00;
  for (;;) {
    resolvePlayerShotHit(m);
    startSound(m, 0x04);
    if (loc_0a59(m)) break;
    yield;
  }
  clearGameActive(m);
  clearScreenRegion(m, RESERVE_SHIP_ICONS_SCREEN_ADDR);
  drawLivesDigit(m, 0x00);
  loc_19dc(m, 0xfb);
  yield* gameOverFlow(m);
}
