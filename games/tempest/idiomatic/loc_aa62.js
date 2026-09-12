// SPDX-License-Identifier: GPL-3.0-only
import { loc_ab17 } from "./loc_ab17.js";
import { loc_aa92 } from "./loc_aa92.js";
import { loc_a8e7 } from "./loc_a8e7.js";

// Prime one draw slot, run the shared prep, then dispatch the per-frame driver.
export function loc_aa62(m) {
  loc_ab17(m, 0x30, 0x00);
  loc_aa92(m);
  loc_a8e7(m);
}
