// SPDX-License-Identifier: GPL-3.0-only
/** guardBlockOrBlankDisplay — let the sequence move on only if a block of the program image still adds up.
 * A running eight-bit total is seeded from one program byte and fifty-one more added. When it is
 * the one expected, the inner sequence index is stepped and nothing else is touched. Otherwise the
 * display is switched off through the output latch — the written value taken from a program byte
 * too — and one character cell is copied into a pair of work cells (glyph then the colour beside
 * it); that arm leaves the sequence index put, so nothing after it runs. LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { TAMPER_WITNESS, stampCopyrightStrip_ADDR, loc_4a40, loc_4c89, VIDEO_ENABLE_LATCH, loc_a65c } from "./names.js";

const GUARDED_BYTES = 51;
const EXPECTED_TOTAL = 239;
const LATCH_WRITE_OFFSET = 10;
const CHARACTER_PLANE_BIT = 0x0400;

export function guardBlockOrBlankDisplay(m) {
  const { mem8 } = m;
  let total = mem8[loc_4a40];
  for (let i = 0; i < GUARDED_BYTES; i++) total = u8(total + mem8[stampCopyrightStrip_ADDR + i]);

  if (total === EXPECTED_TOTAL) {
    advanceSequenceSubStep(m);
    return;
  }
  m.mem.write8(VIDEO_ENABLE_LATCH, mem8[loc_4c89], LATCH_WRITE_OFFSET);
  mem8[TAMPER_WITNESS] = mem8[loc_a65c];
  mem8[TAMPER_WITNESS + 1] = mem8[loc_a65c & ~CHARACTER_PLANE_BIT];
}
