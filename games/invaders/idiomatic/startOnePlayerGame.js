// SPDX-License-Identifier: GPL-3.0-only
import { startGameFlow } from "./startGameFlow.js";

// One-player game start: no two-player flag, deduct a single credit, then run the shared game-start init.
// Generator.
export function* startOnePlayerGame(m) {
  yield* startGameFlow(m, 0x00, 0x99);
}
