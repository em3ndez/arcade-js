// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintPlayerTwoScoreReadout — ROM 0x0D61 [seen]
 *
 * WHAT IT IS. The entry that repaints player two's six-digit score on the character plane. It
 * paints nothing itself: it fixes the three inputs of the shared digit painter at 0x0D73
 * (paintSixDigitFieldSuppressingLeadingZeros [seen]) and jumps into it. The ROM is three loads and a
 * `jr 0x0d73` (lift: translated/loc_0d61.js): DE = the first screen cell, HL = the top byte of
 * the score, C = the colour.
 *
 * ROLE IN THE MACHINE. Each score is six decimal digits packed two to a byte, least significant
 * pair at the lowest address (PLAYER2_SCORE_HI 0xAD38 is the most significant pair). The painter walks DOWN
 * from that top byte while its screen cursor walks right from PLAYER2_SCORE_READOUT_BASE 0xA501, so the
 * digits come out most significant first. Its twin paintPlayerOneScoreReadout (0x0D57) and
 * paintHighScoreReadout differ only in the triple chosen (mechanisms.md, score readouts).
 *
 * All three inputs are constants chosen here; whatever the caller held in those registers is
 * discarded. LIVE-OUT: memory -- the six character cells (and their colours) the painter fills.
 */

import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";
import { PLAYER2_SCORE_HI, PLAYER2_SCORE_READOUT_BASE } from "./names.js";

// The colour byte laid beside every digit cell (`ld c,0x10`); all three readouts use 0x10.
const COLOUR = 0x10;

export function paintPlayerTwoScoreReadout(m) {
  // Hand the fixed triple to the painter; its return (the pointer and cursor it leaves) is passed
  // straight back, as the ROM's tail jump leaves the painter's own `ret` to return to our caller.
  return paintSixDigitFieldSuppressingLeadingZeros(m, PLAYER2_SCORE_HI, PLAYER2_SCORE_READOUT_BASE, COLOUR);
}
