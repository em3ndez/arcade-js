// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SEGMENT, ENEMY_DEPTH, LANE_LIMIT, SCRIPT_BRANCH_FLAG } from "./names.js";

// For the given slot, look up its boundary value (a zero table entry means the
// maximum) and set a flag to 1 when the boundary is at or beyond the slot's
// coordinate, else 0.
export function loc_9c21(m, x = m.regs.x) {
  const { mem8 } = m;
  const segment = mem8[u16(ENEMY_SEGMENT + x)];
  let bound = mem8[u16(LANE_LIMIT + segment)];
  if (bound === 0) bound = 0xff; // a zero entry reads as the maximum bound
  mem8[SCRIPT_BRANCH_FLAG] = bound >= mem8[u16(ENEMY_DEPTH + x)] ? 1 : 0;
}
