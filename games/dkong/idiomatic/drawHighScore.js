// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawHighScore — repaint the high-score readout from the stored record; the shared tail of the
 * two score tasks that redraw it. HIGH_SCORE is a three-byte packed-BCD counter held
 * least-significant first; pointing the render source at its most-significant pair makes the
 * fixed-column BCD renderer walk the bytes top-down, painting in reading order up the column.
 */
import { HIGH_SCORE } from "./names.js";
import { renderBcdColumnFixedCell } from "./renderBcdColumnFixedCell.js";

export function drawHighScore(m) {
  // Source := the high score's most-significant pair (walk the three BCD bytes top-down).
  return (m.regs.de = HIGH_SCORE + 2, renderBcdColumnFixedCell(m));
}
