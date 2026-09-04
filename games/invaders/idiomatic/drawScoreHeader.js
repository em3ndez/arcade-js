// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { SCORE_HEADER_TEXT, SCORE_HEADER_SCREEN_ADDR } from "./names.js";

/**
 * drawScoreHeader — paint the fixed score-header text line across the top of the screen.
 *
 * WHAT IT IS
 *   The plainest member of the screen-furniture family. It seats a preset run of 0x1c (28) sprite ids
 *   sourced from SCORE_HEADER_TEXT (0x1ae4), points the screen pointer at SCORE_HEADER_SCREEN_ADDR
 *   (0x241e), and hands off to the sprite-list driver — which walks the id list one byte at a time,
 *   drawing each id as an 8x8 glyph and stepping the destination one glyph cell per id, so the header
 *   comes out as a 28-glyph line of preset text.
 *
 * ROLE IN THE MACHINE
 *   Part of the screen's static furniture (the score header, CREDIT label, copyright, lives readout),
 *   each drawn by a small routine that seats a few constants and delegates to the glyph machinery.
 *   Emitted during the score-panel redraw pass (redrawScorePanel blanks video RAM, then calls
 *   drawScoreHeader, three sibling draws, and drawCreditLabel), which is why the top row reads as one
 *   static frame. drawSpriteList (0x08f3) is the shared driver; both the text (SCORE_HEADER_TEXT) and
 *   the destination (SCORE_HEADER_SCREEN_ADDR) are [seen] cells.
 *
 * ROM 0x191a-0x1924.  Grounding: [seen].
 * LIVE-OUT: HL (advanced past the drawn run by the sprite-list driver).
 */
// Draw a preset run of sprites (fixed id list, count and screen slot) through the sprite-list driver.
export function drawScoreHeader(m) {
  // Seat the id source (SCORE_HEADER_TEXT), the count (0x1c = 28 glyphs) and the fixed screen slot
  // (SCORE_HEADER_SCREEN_ADDR), then let the sprite-list driver lay the line down glyph by glyph.
  return drawSpriteList(m, SCORE_HEADER_TEXT, 0x1c, SCORE_HEADER_SCREEN_ADDR);
}
