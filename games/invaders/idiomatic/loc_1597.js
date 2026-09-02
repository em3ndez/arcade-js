// SPDX-License-Identifier: GPL-3.0-only
import { loc_15c5 } from "./loc_15c5.js";
import { loc_18f1 } from "./loc_18f1.js";
import { FLEET_MOVE_DIR, loc_2007, loc_2008, loc_200e, loc_2524, loc_3ea4 } from "./names.js";

// Fleet edge / direction reversal: scan the edge column selected by FLEET_MOVE_DIR; if the fleet has
// reached it, flip the direction and republish the derived step-count and mirror cells, else leave
// state untouched. Live-out: RAM only (the caller ignores the result).
export function loc_1597(m) {
  let dir, step;
  if (m.mem8[FLEET_MOVE_DIR] !== 0) {
    if (!loc_15c5(m, loc_2524)) return;
    step = loc_18f1(m);
    dir = 0x00;
  } else {
    if (!loc_15c5(m, loc_3ea4)) return;
    step = 0xfe;
    dir = 0x01;
  }
  m.mem8[FLEET_MOVE_DIR] = dir;
  m.mem8[loc_2008] = step;
  m.mem8[loc_2007] = m.mem8[loc_200e];
}
