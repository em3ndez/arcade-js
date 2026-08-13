// SPDX-License-Identifier: GPL-3.0-only
/** paintPlayerOneScoreReadout — fix the three things the shared digit painter needs and hand over: the character-plane
 * cell the run of digits starts from, the high end of the three-byte packed-decimal field it walks
 * down, and the colour laid beside every cell it fills. All three are constants chosen here, so
 * whatever a caller was holding is discarded. LIVE-OUT: memory -- the cells the painter fills. */

import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";
import { PLAYER1_SCORE_HI, loc_a781 } from "./names.js";

const COLOUR = 0x10;

export function paintPlayerOneScoreReadout(m) {
  const { regs } = m;
  regs.de = loc_a781;
  regs.hl = PLAYER1_SCORE_HI;
  regs.c = COLOUR;
  return paintSixDigitFieldSuppressingLeadingZeros(m);
}
