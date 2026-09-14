// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWord } from "./emitVectorHeaderWord.js";

// Emit a vector word with the fixed low/high byte pair, stepping the cursor past it.
export function loc_ab0d(m) {
  return emitVectorWord(m, 0x20, 0x80);
}
