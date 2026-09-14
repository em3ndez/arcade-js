// SPDX-License-Identifier: GPL-3.0-only
import { loc_df4c } from "./loc_df4c.js";
import { emitVectorHeaderAndClearSlots } from "./emitVectorHeaderAndClearSlots.js";
import { SPINNER_ACCUM } from "./names.js";

// Emit one header word from the halved slot count, then clear the tracked bank.
export function loc_db6f(m) {
  const { mem8 } = m;
  loc_df4c(m, 0x68, mem8[SPINNER_ACCUM] >> 1);
  return emitVectorHeaderAndClearSlots(m, 0x33, 0x4e);
}
