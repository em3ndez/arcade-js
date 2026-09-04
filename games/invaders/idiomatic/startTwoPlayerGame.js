// SPDX-License-Identifier: GPL-3.0-only
import { startGameFlow } from "./startGameFlow.js";

// Two-player game start: set the two-player flag, deduct two credits, then run the shared game-start init.
// Generator.
export function* startTwoPlayerGame(m) {
  yield* startGameFlow(m, 0x01, 0x98);
}
