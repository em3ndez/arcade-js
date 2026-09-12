// SPDX-License-Identifier: GPL-3.0-only
import { loc_a8b4 } from "./loc_a8b4.js";
import { loc_ab17 } from "./loc_ab17.js";

// Run the alternate prep, then prime a draw slot through the shared entry.
export function loc_aa6f(m) {
  loc_a8b4(m);
  loc_ab17(m, 0x00, 0x06);
}
