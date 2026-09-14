// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWord } from "./emitVectorHeaderWord.js";

// Emit a vector word: first byte the y payload, second byte the a payload
// tagged with the mid header bits.
export function loc_df4c(m, a = m.regs.a, y = m.regs.y) {
  return emitVectorWord(m, y, a | 0x60);
}
