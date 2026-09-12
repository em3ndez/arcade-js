// SPDX-License-Identifier: GPL-3.0-only
import { loc_ddf3 } from "./loc_ddf3.js";

// Trampoline: run the mask-merge with the 0x03 mask.
export function loc_dded(m) {
  loc_ddf3(m, 0x03);
}
