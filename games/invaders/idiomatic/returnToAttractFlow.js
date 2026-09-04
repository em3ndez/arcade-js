// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { setGameActive } from "./setGameActive.js";
import { finishAttractCycle } from "./finishAttractCycle.js";
import { GAME_IN_PROGRESS, loc_1aa6, loc_2d18 } from "./names.js";

// Game-over to attract join: type the closing message, hold, clear the field, drop GAME_IN_PROGRESS and
// silence the fleet-tone port, mark the game active, then delegate into the attract teardown. Generator;
// memory + IO.
export function* returnToAttractFlow(m) {
  yield* typePacedSpriteRun(m, loc_1aa6, 0x0a, loc_2d18);
  yield* waitLongDelay(m);
  clearPlayfield(m);
  m.mem8[GAME_IN_PROGRESS] = 0x00;
  m.io.portOut(0x05, 0x00);
  setGameActive(m);
  yield* finishAttractCycle(m);
}
