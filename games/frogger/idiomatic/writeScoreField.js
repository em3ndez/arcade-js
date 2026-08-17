// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeScoreField — draw a score field: print the caller's packed-BCD word as four tilemap digits, then a trailing zero.
 * LIVE-OUT: memory-only.
 */
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function writeScoreField(m, value = m.regs.de, ptr = m.regs.hl) {
  const p = writePackedBcdWord(m, value, ptr);
  return writeScoreDigitStepUp(m, 0, p);
}
