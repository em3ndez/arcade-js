// SPDX-License-Identifier: GPL-3.0-only
// Main-loop entry: clear the score/HUD scratch block, then hand off to the free-running per-frame main loop
// generator.
import { PLAYER1_SCORE_BCD } from "./names.js";
import { mainLoop } from "./mainLoop.js";

export function enterMainLoop(m) {
  const { mem8 } = m;
  for (let i = 0; i < 0x1e; i++) mem8[PLAYER1_SCORE_BCD + i] = 0; // clear the 30-byte scratch block
  return mainLoop(m); // hand off to the per-frame generator
}
