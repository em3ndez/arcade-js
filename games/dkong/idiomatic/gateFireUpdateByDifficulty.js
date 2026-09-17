// SPDX-License-Identifier: GPL-3.0-only
/**
 * gateFireUpdateByDifficulty — read DIFFICULTY, clamp it to the six-slot table, and run the frame
 * gate that slot names, returning its proceed/skip decision to the caller unchanged. The duty
 * cycle widens with difficulty: 0,1 -> 1/2, 2 -> 5/8, 3,4 -> 3/4, 5+ -> 7/8.
 *
 * @param {object} m
 * @returns {boolean}  true to let the caller proceed this frame; false to make it return at once.
 * LIVE-OUT: the proceed/skip decision; no memory is written.
 */

import { DIFFICULTY } from "./names.js";
import { loc_3110 } from "./loc_3110.js";
import { loc_311b } from "./loc_311b.js";
import { loc_3126 } from "./loc_3126.js";
import { loc_3131 } from "./loc_3131.js";

const FRAME_GATE_BY_DIFFICULTY = [loc_3110, loc_3110, loc_311b, loc_3126, loc_3126, loc_3131];

export function gateFireUpdateByDifficulty(m) {
  const difficulty = Math.min(m.mem8[DIFFICULTY], FRAME_GATE_BY_DIFFICULTY.length - 1);
  return FRAME_GATE_BY_DIFFICULTY[difficulty](m);
}
