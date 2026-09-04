// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { loc_0ab6 } from "./loc_0ab6.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { setGameActive } from "./setGameActive.js";
import { loc_0b89 } from "./loc_0b89.js";
import { GAME_IN_PROGRESS, loc_1aa6, loc_2d18 } from "./names.js";

// Game-over to attract join: type the closing message, hold, clear the field, drop GAME_IN_PROGRESS and
// silence the fleet-tone port, mark the game active, then delegate into the attract teardown. Generator;
// memory + IO.
export function* loc_16c9(m) {
  yield* typePacedSpriteRun(m, loc_1aa6, 0x0a, loc_2d18);
  yield* loc_0ab6(m);
  clearPlayfield(m);
  m.mem8[GAME_IN_PROGRESS] = 0x00;
  m.io.portOut(0x05, 0x00);
  setGameActive(m);
  yield* loc_0b89(m);
}
