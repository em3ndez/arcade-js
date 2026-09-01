// SPDX-License-Identifier: GPL-3.0-only
import { loc_2002 } from "./names.js";
import { loc_19dc } from "./loc_19dc.js";

// Clear the prize-active flag, then mask bit 3 off the sound shadow; value-out A.
export function loc_154a(m) {
  m.mem8[loc_2002] = 0;
  return loc_19dc(m, 0xf7);
}
