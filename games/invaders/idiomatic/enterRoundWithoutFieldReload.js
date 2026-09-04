// SPDX-License-Identifier: GPL-3.0-only
import { setGameActive } from "./setGameActive.js";
import { startSound } from "./startSound.js";
import { mainLoop } from "./mainLoop.js";

// Field-arm tail without the field reload: mark the game active, cue the round-start sound, then fall
// into the in-game frame loop. Generator; memory + IO.
export function* enterRoundWithoutFieldReload(m) {
  setGameActive(m);
  startSound(m, 0x20);
  yield* mainLoop(m);
}
