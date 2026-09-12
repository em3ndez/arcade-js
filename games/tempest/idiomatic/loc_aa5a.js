// SPDX-License-Identifier: GPL-3.0-only
import { loc_ab14 } from "./loc_ab14.js";
import { loc_aa69 } from "./loc_aa69.js";

// Draw one object slot, then run the shared post-draw step.
export function loc_aa5a(m) {
  loc_ab14(m, 0x08);
  return loc_aa69(m);
}
