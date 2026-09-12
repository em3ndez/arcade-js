// SPDX-License-Identifier: GPL-3.0-only
import { loc_9e } from "./names.js";
import { loc_df4c } from "./loc_df4c.js";

// Skip when the latched byte already equals the input; otherwise latch it and
// emit a fixed-tag record built from the input.
export function loc_b0d1(m, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[loc_9e] === y) return;
  mem8[loc_9e] = y;
  loc_df4c(m, 0x08, y);
}
