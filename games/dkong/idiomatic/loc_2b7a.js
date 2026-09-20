// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b7a — snap Mario onto an 8-pixel column and commit it, routing on his airborne horizontal
 * velocity. Velocity high byte zero -> pass his raw X to the sibling snap arm, which snaps and
 * commits; nonzero -> snap here ((X | 7) - 4) and pass the snapped X to the commit. Both arms
 * compute the same snapped X and commit it the same way — velocity picks the route, not the
 * outcome. The two-level caller-skip is passed back unchanged.
 *
 * LIVE-OUT: Mario's X and sprite-record X in memory, the result value 1, and the caller-skip boolean.
 */

import { loc_2b8b } from "./loc_2b8b.js";
import { loc_2b91 } from "./loc_2b91.js";
import { MARIO_AIR_VX_HI, MARIO_X } from "./names.js";

export function loc_2b7a(m) {
  const { mem8 } = m;

  const velocityHiZero = mem8[MARIO_AIR_VX_HI] === 0;
  const marioX = mem8[MARIO_X];

  if (velocityHiZero) {
    return loc_2b8b(m, marioX); // sibling arm snaps and commits
  }

  // snap to the 8-pixel column, then commit directly
  return loc_2b91(m, (marioX | 0x07) - 4);
}
