// SPDX-License-Identifier: GPL-3.0-only
/** snapHeadingOntoTheTurnTarget — end a turn by putting the ship exactly on the heading it was turning toward, then scroll the world for it.
 * The target is handed in. A turn steps 3 or 4 against targets spaced 32 apart; 3 does not divide 32, so the walk lands
 * 2 short, fails the guard and overshoots to one past — and this is the arm that stops it. LIVE-OUT: memory. */

import { scrollWorldAtTheEraPace } from "./scrollWorldAtTheEraPace.js";
import { PLAYER_HEADING } from "./names.js";

export function snapHeadingOntoTheTurnTarget(m, target = m.regs.b) {
  const { mem8 } = m;
  mem8[PLAYER_HEADING] = target;
  scrollWorldAtTheEraPace(m);
}
