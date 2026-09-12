// SPDX-License-Identifier: GPL-3.0-only
import { loc_df57 } from "./loc_df53.js";

// Emit a vector word: first byte the y payload, second byte the a payload
// tagged with the mid header bits.
export function loc_df4c(m, a = m.regs.a, y = m.regs.y) {
  return loc_df57(m, y, a | 0x60);
}
