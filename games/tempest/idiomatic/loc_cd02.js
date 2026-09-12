// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: register the fixed sound id 0x3f through the enable gate.
export function loc_cd02(m) {
  loc_ccc3(m, 0x3f);
}
