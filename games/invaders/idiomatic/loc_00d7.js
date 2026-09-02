// SPDX-License-Identifier: GPL-3.0-only
import { blankScreenStrip } from "./blankScreenStrip.js";
import { loc_21fb, loc_22fb } from "./names.js";

// Seed the mirrored per-player cells to 2, then blank the fixed screen strip unless its guard is set.
export function loc_00d7(m) {
  m.mem8[loc_21fb] = 0x02;
  m.mem8[loc_22fb] = 0x02;
  return blankScreenStrip(m);
}
