// SPDX-License-Identifier: GPL-3.0-only
/** paintHighScoreReadout — fix the three arguments of the six-digit packed-decimal readout printer and fall
 * straight into it: the tally to print, taken from its highest byte because the printer walks
 * downward; the cell its leftmost digit lands in; and the colour every digit is given. Choosing
 * that triple is the whole of this entry, and whatever a caller held in those registers is
 * discarded. LIVE-OUT: memory — the digits and their colours, written by the printer. */

import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";
import { HIGH_SCORE_HI } from "./names.js";

const FIRST_DIGIT_CELL = 0xa641;
const DIGIT_COLOUR = 0x10;

export function paintHighScoreReadout(m) {
  const { regs } = m;
  regs.de = FIRST_DIGIT_CELL;
  regs.hl = HIGH_SCORE_HI;
  regs.c = DIGIT_COLOUR;
  return paintSixDigitFieldSuppressingLeadingZeros(m);
}
