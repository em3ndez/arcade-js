// SPDX-License-Identifier: GPL-3.0-only
import { loc_3 } from "./names.js";
import { loc_ab17 } from "./loc_ab17.js";
import { loc_a8b4 } from "./loc_a8b4.js";

// Draw one vector list, add a second while a status nibble is still low, then run frame setup.
export function loc_aa79(m) {
  const { mem8 } = m;
  loc_ab17(m, 0x00, 0x32);
  if ((mem8[loc_3] & 0x1f) < 0x10) loc_ab17(m, 0xe0, 0x22);
  return loc_a8b4(m);
}
