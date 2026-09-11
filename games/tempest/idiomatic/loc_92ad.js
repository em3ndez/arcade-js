// SPDX-License-Identifier: GPL-3.0-only
import { loc_50 } from "./names.js";

// Clear one state byte to zero, then return.
export function loc_92ad(m) {
  const { mem8 } = m;
  mem8[loc_50] = 0;
}
