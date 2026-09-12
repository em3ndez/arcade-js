// SPDX-License-Identifier: GPL-3.0-only
import { loc_ccc3 } from "./loc_ccc3.js";

// Trampoline: raise the fixed sound id and run the sound gate.
export function loc_cd06(m) {
  loc_ccc3(m, 0xcf);
}
