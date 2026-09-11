// SPDX-License-Identifier: GPL-3.0-only
import { loc_10a } from "./names.js";

// Clear the state byte to zero.
export function loc_9bca(m) {
  const { mem8 } = m;
  mem8[loc_10a] = 0;
}
