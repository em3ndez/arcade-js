// SPDX-License-Identifier: GPL-3.0-only
import { startGameFlow } from "./startGameFlow.js";

/**
 * startTwoPlayerGame (ROM two-player start arm loc_086d -> startGameFlow at loc_079b) -- begin a 2P game.
 *
 * WHAT IT IS
 *   The two-player entry into the shared game-start init. It runs the common startGameFlow with the
 *   two-player flag set (0x01) and a credit delta of 0x98. 0x98 is BCD "minus two" (ten's-complement:
 *   adding 0x98 with a decimal-adjust subtracts 2), so a two-player game deducts two credits from the
 *   tally. Its sibling startOnePlayerGame passes (0x00, 0x99) -- no two-player flag, minus one credit.
 *
 * ROLE IN THE MACHINE
 *   Reached from the credit screen (creditScreen) when the player presses the two-player start (IN1 bit 1).
 *   In the ROM this is the two-player arm at 0x086d, which sets A=1 (the two-player flag) and tail-jumps
 *   into startGameFlow at 0x079b; the 0x98 two-credit deduction is seeded by the two-player credit prompt
 *   loc_0857 (mvi b,0x98 at 0x085d) that precedes it. startGameFlow records the mode, adjusts the BCD credit
 *   tally, seeds both players' records/fields/shields, and falls into the round-start chain.
 *
 * Grounding: spine flow -- no per-routine cert in names.js ROUTINES; the credit -> prompt -> start path is
 *   described in mechanisms.md "The in-game main loop and round restarts". ROM correspondence confirmed
 *   against translated/loc_086d.js and translated/loc_0857.js.
 *
 * LIVE-OUT: none for callers -- a terminal start flow that yields into the round-start chain. Generator.
 */
// Two-player game start: set the two-player flag, deduct two credits, then run the shared game-start init.
// Generator.
export function* startTwoPlayerGame(m) {
  // two-player flag = 0x01, credit delta = 0x98 (BCD -2); the shared init does the rest.
  yield* startGameFlow(m, 0x01, 0x98);
}
