// SPDX-License-Identifier: GPL-3.0-only
/**
 * showCreditScreen — warm-restart entry: arm game mode 3, enable the frame interrupt, run the
 * blank-screen display setup, then hold a static screen forever.
 *
 * Reached from the boot fork when the credit count is nonzero (credits present). It arms the
 * game-mode cell to 3 — a warm-restart state entry that never returns — enables the frame
 * interrupt, runs the blank-screen display setup, then tail-hands to the fixed-screen painter,
 * which paints a canned screen and spins forever. What game-mode 3 and the held screen mean is
 * not pinned.
 */

import { enableNmi } from "./enableNmi.js";
import { blankScreen } from "./blankScreen.js";
import { holdFixedScreen } from "./holdFixedScreen.js";
import { GAME_STATE } from "./names.js";

export function* showCreditScreen(m) {
  const { mem8 } = m;

  // Arm game mode 3.
  mem8[GAME_STATE] = 3;

  enableNmi(m);
  blankScreen(m); // clear the screen and seed the board-mode fills

  // Tail hand-off to the fixed-screen painter: it holds a canned screen forever and never returns.
  return yield* holdFixedScreen(m);
}
