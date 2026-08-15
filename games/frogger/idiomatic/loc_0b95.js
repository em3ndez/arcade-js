// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b95 — draw a score field: print the caller's packed-BCD word as four tilemap digits, then a trailing zero.
 * LIVE-OUT: memory-only.
 */
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function loc_0b95(m) {
  writePackedBcdWord(m);
  return writeScoreDigitStepUp(m, 0);
}
