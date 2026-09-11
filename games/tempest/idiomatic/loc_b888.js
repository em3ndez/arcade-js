// SPDX-License-Identifier: GPL-3.0-only
import { loc_139, loc_13a } from "./names.js";
import { loc_c196 } from "./loc_c196.js";

// Rebuild the packed nibble table, then seat the two-byte vector-tail value.
export function loc_b888(m) {
  const { mem8 } = m;
  loc_c196(m);
  mem8[loc_139] = 0x7f;
  mem8[loc_13a] = 0x04;
}
