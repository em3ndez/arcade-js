// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdByte } from "./drawBcdByte.js";
import { CREDIT_COUNT, CREDIT_COUNT_SCREEN_ADDR } from "./names.js";

/**
 * drawCreditCount — paint the coin/credit tally at its fixed slot on the bottom status line.
 *
 * WHAT IT IS
 *   The credit tally (how many coins are banked) is stored as a two-digit BCD byte. This routine draws
 *   those two decimal digits at the credit readout position on screen.
 *
 * ROLE IN THE MACHINE
 *   CREDIT_COUNT (0x20eb) is the BCD credit counter the vblank interrupt banks on each coin-press edge.
 *   CREDIT_COUNT_SCREEN_ADDR (0x3c01) is its fixed video-RAM slot beside the CREDIT label. This seats HL
 *   at that slot and delegates to drawBcdByte, which draws the high nibble then the low nibble as two
 *   glyphs (each nibble is a 0-9 decimal digit). Called from the panel repaints redrawScorePanel (0x1956)
 *   and drawCreditReadout (0x1979), and from the game-start init startGameFlow after the credit is
 *   deducted, so the on-screen count always tracks the stored tally.
 *
 * ROM 0x1947-0x194f.  Grounding: [seen].
 *
 * LIVE-OUT: HL, advanced two glyphs past the slot by the drawBcdByte tail.
 */
export function drawCreditCount(m) {
  // Seat HL at the credit readout's video-RAM slot, then draw the BCD credit byte there as two digits.
  // (The comma expression sets HL first so the delegated drawBcdByte blits at the right column.)
  return (m.regs.hl = CREDIT_COUNT_SCREEN_ADDR, drawBcdByte(m, m.mem8[CREDIT_COUNT]));
}
