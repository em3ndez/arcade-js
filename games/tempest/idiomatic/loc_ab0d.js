// SPDX-License-Identifier: GPL-3.0-only
import { loc_df57 } from "./loc_df53.js";

// Emit a vector word with the fixed low/high byte pair, stepping the cursor past it.
export function loc_ab0d(m) {
  return loc_df57(m, 0x20, 0x80);
}
