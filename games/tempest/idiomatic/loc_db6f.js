// SPDX-License-Identifier: GPL-3.0-only
import { loc_df4c } from "./loc_df4c.js";
import { loc_db88 } from "./loc_db88.js";
import { loc_50 } from "./names.js";

// Emit one header word from the halved slot count, then clear the tracked bank.
export function loc_db6f(m) {
  const { mem8 } = m;
  loc_df4c(m, 0x68, mem8[loc_50] >> 1);
  return loc_db88(m, 0x33, 0x4e);
}
