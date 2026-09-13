// SPDX-License-Identifier: GPL-3.0-only
import { SPINNER_ACCUM } from "./names.js";

// Clear one state byte to zero, then return.
export function loc_92ad(m) {
  const { mem8 } = m;
  mem8[SPINNER_ACCUM] = 0;
}
