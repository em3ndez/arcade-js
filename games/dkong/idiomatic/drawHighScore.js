// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawHighScore — repaint the on-screen high-score readout from the stored record.
 *
 * The short tail shared by the two score tasks that need the record redrawn:
 *   - the score-add task, which adds a payload to the player-up's score and, when the
 *     new total beats the record, copies it into HIGH_SCORE before falling through
 *     here to repaint it; and
 *   - the counter-draw task, on its high-score selector.
 * Both end up pointing the render source at the high score and handing off to the
 * fixed-column BCD renderer, so the record on screen always tracks the stored value.
 *
 * HIGH_SCORE is a three-byte packed-BCD counter held least-significant first. Pointing
 * the source at its most-significant pair makes the renderer walk the three bytes
 * top-down, so the six digits paint in reading order climbing the fixed high-score
 * column. Whatever source the caller left is a don't-care — this routine overwrites it
 * on every entry, and that unconditional override is the whole reason it exists as a
 * shared tail instead of being inlined into each caller.
 *
 * The renderer takes its source pointer through the machine's register image, so this
 * routine stages it exactly where the renderer reads it.
 *
 * NOT CLAIMED: what the destination column is on screen. Whatever cell the renderer
 * hard-wires, this routine draws the high-score VALUE there.
 *
 * LIVE-OUT: memory-only — the six digit cells the renderer paints into video RAM.
 */
import { HIGH_SCORE } from "./names.js";
import { renderBcdColumnFixedCell } from "./renderBcdColumnFixedCell.js";

export function drawHighScore(m) {
  const { regs } = m;

  // Source := the high score's most-significant pair, so the renderer walks the
  // three packed BCD bytes top-down (six digits, reading order, up the column).
  regs.de = HIGH_SCORE + 2;

  // Fixed-column entry: the renderer hard-wires the destination to the high-score
  // column and paints the digits.
  renderBcdColumnFixedCell(m);
}
