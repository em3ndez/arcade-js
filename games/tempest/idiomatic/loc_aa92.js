// SPDX-License-Identifier: GPL-3.0-only
import { loc_ab14 } from "./loc_ab14.js";
import { loc_aa97 } from "./loc_aa97.js";

// Draw the fixed slot, then hand off to the shared count-draw tail.
export function loc_aa92(m) {
  loc_ab14(m, 0x02);
  return loc_aa97(m);
}
