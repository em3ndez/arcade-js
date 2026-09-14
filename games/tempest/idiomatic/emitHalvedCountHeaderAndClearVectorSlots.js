// SPDX-License-Identifier: GPL-3.0-only
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { emitVectorHeaderAndClearSlots } from "./emitVectorHeaderAndClearSlots.js";
import { SPINNER_ACCUM } from "./names.js";

// Emit one header word from the halved slot count, then clear the tracked bank.
export function emitHalvedCountHeaderAndClearVectorSlots(m) {
  const { mem8 } = m;
  emitTaggedVectorWord(m, 0x68, mem8[SPINNER_ACCUM] >> 1);
  return emitVectorHeaderAndClearSlots(m, 0x33, 0x4e);
}
