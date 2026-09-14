// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { POKEY1_AUDC1, POKEY2_AUDC1 } from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

/**
 * emitFixedHeaderAndClearVectorSlots — lay a fixed framing word into the display list, then
 * blank four even-indexed control slots in each of two register banks. ROM 0xdb84.
 *
 * Role in the machine: a per-pass setup step. It opens the vector record with a constant
 * framing word — emitCoordinateVectorWord(0x33, 0x0a) packs those two fixed scalars into a
 * tagged vector-generator word through the draw cursor — and then zeroes the even-indexed
 * control slots (x = 6, 4, 2, 0) of the two banks named here POKEY1_AUDC1 (0x60c1) and
 * POKEY2_AUDC1 (0x60d1), clearing that state before the pass refills it.
 *
 * Behavior: call emitCoordinateVectorWord(m, 0x33, 0x0a) to emit the framing word, then loop
 * x from 0x06 down to 0 by twos, writing 0x00 to POKEY1_AUDC1+x and POKEY2_AUDC1+x each step.
 *
 * Live-out: the framing word emitted through the draw cursor (and its advanced cursor state),
 * plus four zeroed even slots in each of the two 0x60c1/0x60d1 banks. Grounding: [seen].
 */
export function emitFixedHeaderAndClearVectorSlots(m) {
  const { mem8 } = m;

  // Fixed framing word opening the record.
  emitCoordinateVectorWord(m, 0x33, 0x0a);

  // Blank the four even-indexed slots (6,4,2,0) of both register banks.
  for (let x = 0x06; x >= 0; x -= 2) {
    mem8[u16(POKEY1_AUDC1 + x)] = 0x00;
    mem8[u16(POKEY2_AUDC1 + x)] = 0x00;
  }
}
