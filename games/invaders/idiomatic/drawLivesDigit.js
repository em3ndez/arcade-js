// SPDX-License-Identifier: GPL-3.0-only
import { drawDigit } from "./drawDigit.js";
import { LIVES_DIGIT_SCREEN_ADDR } from "./names.js";

/**
 * drawLivesDigit -- draw the remaining-lives count as a single digit glyph at its fixed screen slot.
 *
 * WHAT IT IS
 *   The numeric half of the bottom-of-screen lives readout: it plots one digit (the current life count) at
 *   a fixed spot, paired on screen with the reserve-ship icons drawn just above it.
 *
 * ROLE IN THE MACHINE
 *   Seats the destination HL = LIVES_DIGIT_SCREEN_ADDR (0x2501), masks the count in A to its low nibble
 *   (0-15), and tail-delegates to drawDigit, which maps the nibble to its glyph id (A += 0x1a) and blits it
 *   as an 8x8 sprite via drawSprite8x8. Reached by fall-through from decrementShipsAndDrawReadout (ROM
 *   0x1a7f, which restores the true life count first so the digit and the reserve icons agree), and by
 *   other callers on their own -- including gameOverFlow, which zeroes A first to force a "0".
 *
 * ROM 0x1a8b-0x1a92.  Grounding: [seen].
 *
 * LIVE-OUT: HL advanced one glyph cell down-screen past the digit (drawDigit -> drawSprite8x8).
 */
export function drawLivesDigit(m, a = m.regs.a) {
  // Seat the screen base then delegate: HL points at the lives slot, and drawDigit turns the low nibble of
  // A into its glyph (the mask keeps the index in the digit range).
  return (m.regs.hl = LIVES_DIGIT_SCREEN_ADDR, drawDigit(m, a & 0x0f));
}
