// SPDX-License-Identifier: GPL-3.0-only
import { clearScreenStrip } from "./clearScreenStrip.js";
import { loc_20ce, loc_391c } from "./names.js";

// Blank a fixed screen strip, unless the mode-guard cell is already set.
export function loc_08e4(m) {
  if (m.mem8[loc_20ce] !== 0) return;
  return clearScreenStrip(m, 0x20, loc_391c);
}
