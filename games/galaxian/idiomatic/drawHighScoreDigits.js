// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawHighScoreDigits — repaint the shared high-score number into its fixed VRAM field.
 *
 * WHAT IT IS
 *   Paints the six-digit high score. It fixes the VRAM digit-field cursor at loc_5241 (0x5241, the
 *   high-score field base in the character map) and draws the caller's packed-BCD number there. The
 *   source pointer is supplied by the caller — it is not tied to HIGH_SCORE_BCD here — because both call
 *   sites pass the address they just finished updating.
 *
 * ROLE IN THE MACHINE
 *   A thin wrapper over drawBcdNumberColumn (0x2261): that leaf walks three packed-BCD bytes downward
 *   from the source pointer and stamps six digit tiles up the VRAM column (high nibble then low per byte,
 *   stepping the cursor one row up, -32, per digit, with a four-digit leading-zero blank budget). This
 *   routine is reached from two places: the high-score update tail addBcdScoreIncrementAndUpdateHighScore
 *   (after a new higher total has been copied into HIGH_SCORE_BCD at 0x40a8), and the display-command
 *   opcode-5 score redraw drawScoreFieldByIndex when its index selects the high-score field (index 2).
 *   No work-RAM write; it only repaints VRAM.
 *
 * ROM 0x21f8.  Grounding: [seen].
 *
 * LIVE-OUT: whatever drawBcdNumberColumn returns (the high-score digits repainted in VRAM at loc_5241).
 */
import { drawBcdNumberColumn } from "./drawBcdNumberColumn.js";
import { loc_5241 } from "./names.js";

export function drawHighScoreDigits(m, source = m.regs.de) {
  // Fix the digit-field cursor at the high-score VRAM field (loc_5241) and paint six BCD digits from `source`.
  return drawBcdNumberColumn(m, source, loc_5241);
}
