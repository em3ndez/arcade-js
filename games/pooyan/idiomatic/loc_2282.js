// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_0c45 } from "./loc_0c45.js";
import {
  loc_8f0e,
  loc_8f0f,
  OBJECT_VEL_X,
  OBJECT_VEL_Y,
  MOTION_PARAM_TABLE_2712,
  MOTION_PARAM_TABLE_271C,
  MOTION_PARAM_TABLE_2730,
} from "./names.js";
/**
 * loc_2282 — load the current phase's motion params, then step the phase.
 *
 * The phase selector picks one byte and two little-endian words from three parallel tables: the
 * byte lands in the phase-param slot, the words in the two velocity slots. The phase index is
 * then bumped and, when it reaches 9, clamped back to 8 so the tail phases loop.
 *
 * LIVE-OUT: memory only — the caller reads the three loaded slots back out of memory.
 */
export function loc_2282(m) {
  const { mem8, mem16 } = m;

  const phase = mem8[loc_8f0f];
  mem8[loc_8f0e] = loc_0020(m, MOTION_PARAM_TABLE_2712, phase)[0];
  mem16[OBJECT_VEL_X] = loc_0c45(m, phase, MOTION_PARAM_TABLE_271C);
  mem16[OBJECT_VEL_Y] = loc_0c45(m, phase, MOTION_PARAM_TABLE_2730);

  const next = (mem8[loc_8f0f] + 1) & 0xff;
  mem8[loc_8f0f] = next === 0x09 ? 0x08 : next; // clamp 9 -> 8: loop the tail phases
}
