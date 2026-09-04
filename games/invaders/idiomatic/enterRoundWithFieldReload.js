// SPDX-License-Identifier: GPL-3.0-only
import { loadReferenceAlienState } from "./loadReferenceAlienState.js";
import { setGameActive } from "./setGameActive.js";
import { startSound } from "./startSound.js";
import { mainLoop } from "./mainLoop.js";

// Field-arm tail: load the active player's saved field, mark the game active, cue the round-start sound,
// then fall into the in-game frame loop. Generator; memory + IO.
export function* enterRoundWithFieldReload(m) {
  loadReferenceAlienState(m);
  setGameActive(m);
  startSound(m, 0x20);
  yield* mainLoop(m);
}
