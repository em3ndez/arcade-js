// SPDX-License-Identifier: GPL-3.0-only
import { loc_3aa, loc_125 } from "./names.js";

// Reset leaf: zero a pair of working cells at once.
export function loc_a831(m) {
  const { mem8 } = m;
  mem8[loc_3aa] = 0x00;
  mem8[loc_125] = 0x00;
}
