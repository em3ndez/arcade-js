// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_37, loc_73, loc_9e } from "./names.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_c43c } from "./loc_c43c.js";
import { loc_c772 } from "./loc_c772.js";
import { loc_c423 } from "./loc_c423.js";
import { loc_c3ba } from "./loc_c3ba.js";

// Draw a framed element in two passes: emit the current slot with the colour live,
// step back one slot and re-emit uncoloured, then restore the colour and close it.
// Returns the stepped-back slot index.
export function loc_c3ee(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  const color = a;
  mem8[loc_37] = x;
  loc_df4c(m, 0x08, mem8[loc_9e]);
  loc_c43c(m);
  loc_c772(m, 0x61);
  mem8[loc_73] = color;
  loc_c423(m);
  mem8[loc_37] = u8(mem8[loc_37] - 1);
  mem8[loc_73] = 0x00;
  loc_df4c(m, 0x08, mem8[loc_9e]);
  loc_c423(m);
  mem8[loc_73] = color;
  loc_c43c(m);
  loc_c3ba(m);
  return mem8[loc_37];
}
