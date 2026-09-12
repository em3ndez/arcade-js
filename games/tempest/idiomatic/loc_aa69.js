// SPDX-License-Identifier: GPL-3.0-only
import { loc_aa92 } from "./loc_aa92.js";
import { loc_a8e7 } from "./loc_a8e7.js";

// Run the shared prep, then dispatch the per-frame driver.
export function loc_aa69(m) {
  loc_aa92(m);
  loc_a8e7(m);
}
