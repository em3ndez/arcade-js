// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrBlankDisplay — let the sequence move on only if a block of the program image still adds up.
 *
 * A running eight-bit total is started from one program byte and fifty-one further bytes are
 * added to it. When the total is the one expected, the inner sequence index is stepped and
 * nothing else is touched. When it is not, the display is switched off through the output latch
 * — with the value written taken from a program byte too, not from an immediate — and one
 * character cell is copied into a pair of work cells, its glyph and then the colour beside it.
 * That arm leaves the sequence index where it stood, so nothing after it runs.
 * LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { TAMPER_WITNESS } from "./names.js";

const TOTAL_SEED = 0x4a40;
const GUARDED_FIRST = 0x0b06;
const GUARDED_BYTES = 51;
const EXPECTED_TOTAL = 239;
const BLANKING_VALUE = 0x4c89;
const DISPLAY_LATCH = 0xc308;
const LATCH_WRITE_OFFSET = 10;
const SAMPLED_CELL = 0xa65c;
const CHARACTER_PLANE_BIT = 0x0400;

export function guardBlockOrBlankDisplay(m) {
  const { mem8 } = m;
  let total = mem8[TOTAL_SEED];
  for (let i = 0; i < GUARDED_BYTES; i++) total = u8(total + mem8[GUARDED_FIRST + i]);

  if (total === EXPECTED_TOTAL) {
    advanceSequenceSubStep(m);
    return;
  }
  m.mem.write8(DISPLAY_LATCH, mem8[BLANKING_VALUE], LATCH_WRITE_OFFSET);
  mem8[TAMPER_WITNESS] = mem8[SAMPLED_CELL];
  mem8[TAMPER_WITNESS + 1] = mem8[SAMPLED_CELL & ~CHARACTER_PLANE_BIT];
}
