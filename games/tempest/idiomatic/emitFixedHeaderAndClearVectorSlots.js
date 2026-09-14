// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { POKEY1_AUDC1, POKEY2_AUDC1 } from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

// Emit one framing record, then clear four even-indexed slots in each of two register banks.
export function emitFixedHeaderAndClearVectorSlots(m) {
  const { mem8 } = m;

  emitCoordinateVectorWord(m, 0x33, 0x0a);

  for (let x = 0x06; x >= 0; x -= 2) {
    mem8[u16(POKEY1_AUDC1 + x)] = 0x00;
    mem8[u16(POKEY2_AUDC1 + x)] = 0x00;
  }
}
