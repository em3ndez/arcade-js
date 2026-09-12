// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: register the fixed sound id 0x2f through the enable gate.
export function loc_ccea(m) {
  loc_ccc3(m, 0x2f);
}
