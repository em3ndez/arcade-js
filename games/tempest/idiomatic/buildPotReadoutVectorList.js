// SPDX-License-Identifier: GPL-3.0-only
import { DSW1_COINAGE, DSW2_OPTIONS } from "./names.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitByteBitsAsDigitsAtF8 } from "./emitByteBitsAsDigitsAtF8.js";
import { emitByteBitsAsDigitsFixed } from "./emitByteBitsAsDigitsFixed.js";
import { assemblePotStatusByte } from "./assemblePotStatusByte.js";

// Build the vector list for the spinner/knob readout: emit a fixed header word and a
// zero-tagged word, then two eight-digit runs keyed by the DIP-switch ports DSW1_COINAGE and
// DSW2_OPTIONS. The exit A of the DSW2_OPTIONS run drives the POKEY pot-scan pulse, which returns the
// assembled pot-status byte; that byte (carried through Y) keys the final eight-digit
// run. The final run's exit A propagates out.
export function buildPotReadoutVectorList(m) {
  const { mem8 } = m;
  emitVectorHeaderWord(m);
  emitBlankVectorWordTag70(m, 0x00);
  emitByteBitsAsDigitsAtF8(m, mem8[DSW1_COINAGE], 0xe8);
  const a = emitByteBitsAsDigitsFixed(m, mem8[DSW2_OPTIONS]);
  const r = assemblePotStatusByte(m, a);
  return emitByteBitsAsDigitsFixed(m, r);
}
