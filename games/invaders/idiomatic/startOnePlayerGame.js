// SPDX-License-Identifier: GPL-3.0-only
import { startGameFlow } from "./startGameFlow.js";

/**
 * startOnePlayerGame — begin a one-player game from the credit screen.
 *
 * WHAT IT IS
 *   The one-player entry into the shared game-start initialisation. It records "one player", deducts a
 *   single credit, and runs the common start-of-game setup (score records, shields, alien field, first
 *   ship into play) that falls into the round-start chain.
 *
 * ROLE IN THE MACHINE
 *   creditScreen (the credit-inserted / press-start screen) polls input port 1 and, on the one-player
 *   start button (bit 2), calls this. It passes two constants to startGameFlow: twoPlayerFlag = 0x00 (so
 *   TWO_PLAYER_GAME stays clear) and creditDelta = 0x99, which is BCD -1 — added to the CREDIT_COUNT
 *   tally it deducts exactly one credit for the game just started. startGameFlow then does the full init
 *   and falls into startRoundFlow. (The two-player twin startTwoPlayerGame passes 0x01 / 0x98 = BCD -2.)
 *
 * ROM 0x0798-0x079a (seats B = 0x99 / A = 0, then falls into the shared body startGameFlow at 0x079b).
 *   Grounding: not separately tagged in names.js (a two-instruction seater in front of startGameFlow).
 *
 * Generator (startGameFlow paces itself and this delegates via yield*).
 */
export function* startOnePlayerGame(m) {
  // One-player (twoPlayerFlag 0x00), deduct one credit (0x99 = BCD -1), then run the shared game-start init.
  yield* startGameFlow(m, 0x00, 0x99);
}
