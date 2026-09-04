// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { CREDIT_LABEL_TEXT, CREDIT_LABEL_SCREEN_ADDR } from "./names.js";

/**
 * drawCreditLabel — paint the fixed "CREDIT" label at the bottom of the screen.
 *
 * WHAT IT IS
 *   Draws a seven-glyph run of preset sprite ids (the letters of the CREDIT label) to a fixed screen
 *   slot by handing a constant id-source, count, and destination to the general sprite-list driver.
 *
 * ROLE IN THE MACHINE
 *   This is one of the small "screen furniture" painters (see mechanisms.md "Attract screen and
 *   status display"). CREDIT_LABEL_TEXT (0x1fa9) is the ROM list of 7 sprite ids for the letters;
 *   CREDIT_LABEL_SCREEN_ADDR (0x3501) is where the run starts in video RAM. drawSpriteList walks the
 *   id list one byte at a time, drawing each id as an 8x8 glyph through drawSprite8x8 and stepping
 *   the destination one glyph-cell along per id, so the label comes out as a seven-glyph line. It is
 *   emitted with the score header and other furniture during the score-panel redraw (redrawScorePanel
 *   / drawCreditReadout both finish on this), which is why they read as one static frame.
 *
 * ROM 0x193c.  Grounding: [seen].
 *
 * LIVE-OUT: HL left one glyph-cell past the last letter (whatever drawSpriteList returns); DE/C also
 * advanced by the driver. No RAM state of its own.
 */
export function drawCreditLabel(m) {
  // Seat the three constants for this label — id source (CREDIT_LABEL_TEXT), glyph count (7), and
  // screen destination (CREDIT_LABEL_SCREEN_ADDR) — and let the shared driver blit the run.
  return drawSpriteList(m, CREDIT_LABEL_TEXT, 0x07, CREDIT_LABEL_SCREEN_ADDR);
}
