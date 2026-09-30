// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrBlankDisplay — let the sequence move on only if a block of the program image still adds up.
 * A running eight-bit total is seeded from one program byte and fifty-one more added. When it is
 * the one expected, the inner sequence index is stepped. Otherwise the display is switched off
 * through the output latch — the written value taken from a program byte too — and one character
 * cell is copied into a pair of work cells (glyph then the colour beside it); that arm leaves the
 * sequence index put, so nothing after it runs. The Z80 also left the total, its spent counter,
 * two cursors and the compare's flags standing in registers; nothing that runs after either arm
 * reads any of them, so they are not handed back.
 * LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { TAMPER_WITNESS, stampCopyrightStrip_ADDR, COPYRIGHT_STRIP_CHECK_SEED, DISPLAY_OFF_VALUE, VIDEO_ENABLE_LATCH, TAMPER_WITNESS_SAMPLE_CELL } from "./names.js";

const GUARDED_BYTES = 51;
const EXPECTED_TOTAL = 239;
const CHARACTER_PLANE_BIT = 1 << 10;

export function guardBlockOrBlankDisplay(m) {
  const { mem8 } = m;
  let total = mem8[COPYRIGHT_STRIP_CHECK_SEED];
  for (let i = 0; i < GUARDED_BYTES; i++) total = u8(total + mem8[stampCopyrightStrip_ADDR + i]);

  if (total === EXPECTED_TOTAL) {
    advanceSequenceSubStep(m);
    return;
  }

  mem8[VIDEO_ENABLE_LATCH] = mem8[DISPLAY_OFF_VALUE];
  const colourCell = TAMPER_WITNESS_SAMPLE_CELL & ~CHARACTER_PLANE_BIT;
  mem8[TAMPER_WITNESS] = mem8[TAMPER_WITNESS_SAMPLE_CELL];
  mem8[TAMPER_WITNESS + 1] = mem8[colourCell];
}
