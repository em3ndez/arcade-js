// SPDX-License-Identifier: GPL-3.0-only
/** paintCreditCountPanel — repaint one two-digit panel field: a single packed byte, in a fixed pen colour,
 * into a fixed pair of cells. Nothing arrives from the caller and nothing is handed back — the
 * colour, the cell the first digit lands in and the byte the digits are read from are constants
 * of this entry, and choosing those three is the whole of it.
 *
 * ROM 0x4AFB-0x4B06 (lift: translated/loc_4afb.js). Grounding: [seen] (names.js ROUTINES 0x4AFB).
 *
 * ROLE IN THE MACHINE. The on-screen credit count. Its callers are the paths around a change of
 * credits -- the coin handlers (tallyCoinSlot1AndAwardCredit, awardCoinCreditThenPulseCoinCounter),
 * both game starts (startOnePlayerGame, startTwoPlayerGame) and the attract credit line
 * (showCreditLine) -- so the digits follow the count.
 *
 * The source is CREDIT_COUNT 0xA986, the packed-BCD credit total (saturating at 0x99), and the
 * destination CREDIT_COUNT_READOUT_CELL 0xA47F is the character-plane cell of the tens digit.
 * LIVE-OUT: the cells painted. */

import { paintTwoUnsuppressedDigitsFromByte } from "./paintTwoUnsuppressedDigitsFromByte.js";
import { CREDIT_COUNT, CREDIT_COUNT_READOUT_CELL } from "./names.js";

// The pen colour both digits are drawn in (`ld c,0x10` at 0x4AFB).
const PEN_COLOUR = 16;

export function paintCreditCountPanel(m) {
  /* One call does it all (the ROM loads C, DE and HL, then calls 0x0D81):
   * paintTwoUnsuppressedDigitsFromByte paints the high digit, then the low one, stepping the
   * cursor one cell on after each. "Unsuppressed" means no leading-zero suppression flag is
   * consulted: both digits are always painted. */
  paintTwoUnsuppressedDigitsFromByte(m, CREDIT_COUNT, CREDIT_COUNT_READOUT_CELL, PEN_COLOUR);
}
