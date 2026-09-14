// SPDX-License-Identifier: GPL-3.0-only
import { DSW1_COINAGE, DSW2_OPTIONS } from "./names.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitByteBitsAsDigitsAtF8 } from "./emitByteBitsAsDigitsAtF8.js";
import { emitByteBitsAsDigitsFixed } from "./emitByteBitsAsDigitsFixed.js";
import { assemblePotStatusByte } from "./assemblePotStatusByte.js";

/**
 * buildPotReadoutVectorList -- build the self-test DIP/pot diagnostic readout. ROM 0xdd0d.
 *
 * Role in the machine: on Tempest's operator self-test screen the board shows the two DIP-switch
 * banks and the spinner/knob (pot) status as rows of eight lit/unlit digits, so the operator can
 * verify each switch and the control wiring. This routine assembles that readout as a vector display
 * list.
 *
 * Behavior: it emits a fixed header word (emitVectorHeaderWord, from loc_df53) and a zero-tagged
 * framing word (emitBlankVectorWordTag70, tag 0x70 with value 0). It then lays two eight-digit runs,
 * one bit per digit: the first keyed by the coinage bank DSW1_COINAGE (positioned at column 0xe8),
 * the second by the options bank DSW2_OPTIONS. The options run returns its exit accumulator a, which
 * assemblePotStatusByte uses to trigger the POKEY pot-scan and fold the result into a single
 * pot-status byte r. A final eight-digit run renders that pot byte, and its exit value propagates out.
 *
 * Live-out: appends the header, blank, and three eight-digit runs to the active vector display buffer;
 * returns the last run's exit accumulator.
 *
 * Grounding: [seen].
 */
export function buildPotReadoutVectorList(m) {
  const { mem8 } = m;
  emitVectorHeaderWord(m);            // fixed header word (loc_df53)
  emitBlankVectorWordTag70(m, 0x00);  // zero-valued 0x70-tagged framing word
  emitByteBitsAsDigitsAtF8(m, mem8[DSW1_COINAGE], 0xe8);   // coinage bank -> digit run at column 0xe8
  const a = emitByteBitsAsDigitsFixed(m, mem8[DSW2_OPTIONS]); // options bank -> digit run; a carries exit
  const r = assemblePotStatusByte(m, a);                  // pulse the POKEY pot scan, fold to status byte
  return emitByteBitsAsDigitsFixed(m, r);                 // pot status -> final digit run; exit propagates
}
