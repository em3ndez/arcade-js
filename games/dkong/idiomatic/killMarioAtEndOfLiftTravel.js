// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioAtEndOfLiftTravel — Mario has reached the end of his run on a 75m lift, so kill him
 * and take him off the lift. Leaf: unconditionally clears MARIO_ACTIVE and EDGE_REPOSITION_FLAG.
 * Zeroing MARIO_ACTIVE is the kill primitive, running the death -> life-lost -> respawn cycle.
 *
 * @param {object} m  the machine (uses m.mem only).
 *
 * LIVE-OUT: memory-only (MARIO_ACTIVE, EDGE_REPOSITION_FLAG).
 */

import { MARIO_ACTIVE, EDGE_REPOSITION_FLAG } from "./names.js";

export function killMarioAtEndOfLiftTravel(m) {
  const { mem8 } = m;

  mem8[MARIO_ACTIVE] = 0;
  mem8[EDGE_REPOSITION_FLAG] = 0;
}
