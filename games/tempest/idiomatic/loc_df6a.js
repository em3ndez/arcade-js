// SPDX-License-Identifier: GPL-3.0-only
import { loc_df6c } from "./loc_df6c.js";

// Emit a vector word tagged with the $70 header, with a zero data byte.
export function loc_df6a(m, a = m.regs.a) {
  return loc_df6c(m, a, 0x00);
}
