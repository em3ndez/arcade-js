// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { POKEY1_AUDC1, POKEY2_AUDC1 } from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

/**
 * emitVectorHeaderAndClearSlots -- emit a caller-supplied framing word, then silence the two
 * POKEY sound chips' channel-control registers. ROM 0xdb88.
 *
 * Role in the machine: this is the shared tail of the vector-display register setup family
 * (emitHalvedCountHeaderAndClearVectorSlots, emitPrimedHeaderAndClearVectorSlots,
 * emitFixedHeaderAndClearVectorSlots all front onto it with different header pairs). It emits
 * one coordinate/framing word into the display list from the caller's A/X pair, then clears
 * the four AUDC (audio channel control) registers of each of Tempest's two POKEY sound chips
 * -- POKEY1 at 0x60c1 and POKEY2 at 0x60d1. Writing 0x00 to an AUDC register silences that
 * voice, so the loop mutes all four voices on both chips as part of re-priming the frame.
 *
 * Behaviour: emitCoordinateVectorWord(a, x) (loc_df39) lays the header word through cursor
 * loc_74. Then the loop steps i = 6, 4, 2, 0 and zeroes POKEY1_AUDC1+i and POKEY2_AUDC1+i --
 * the AUDC registers at even offsets 0, 2, 4, 6 from each chip's voice-1 control register,
 * i.e. the control byte of each of the four voices.
 *
 * Live-out: one framing word appended to the display list at (loc_74) with the cursor
 * advanced; the eight AUDC registers (0x60c1/0x60c3/0x60c5/0x60c7 and 0x60d1/.../0x60d7)
 * cleared to zero. Grounding: [seen].
 */
// Emit the header word for the incoming pair, then blank two output tables at their
// four even slots.
export function emitVectorHeaderAndClearSlots(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  emitCoordinateVectorWord(m, a, x);          // loc_df39: lay the caller's framing word into the list
  for (let i = 6; i >= 0; i -= 2) {           // even offsets 6,4,2,0 -> the four voices' AUDC bytes
    mem8[u16(POKEY1_AUDC1 + i)] = 0x00;        // silence POKEY1 voice control
    mem8[u16(POKEY2_AUDC1 + i)] = 0x00;        // silence POKEY2 voice control
  }
}
