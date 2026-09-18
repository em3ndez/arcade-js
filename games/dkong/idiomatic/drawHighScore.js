// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawHighScore — repaint the on-screen high-score readout from the stored record.
 *
 * The short tail shared by the two score tasks that need the record redrawn. Both point the
 * render source at the high score and hand off to the fixed-column BCD renderer. HIGH_SCORE
 * is a three-byte packed-BCD counter held least-significant first; pointing the source at
 * its most-significant pair makes the renderer walk the bytes top-down, so the digits paint
 * in reading order up the column. Whatever source the caller left is overwritten
 * unconditionally here — the whole reason this exists as a shared tail.
 */
import { HIGH_SCORE } from "./names.js";
import { renderBcdColumnFixedCell } from "./renderBcdColumnFixedCell.js";

export function drawHighScore(m) {
  const { regs } = m;

  // Source := the high score's most-significant pair (walk the three BCD bytes top-down).
  regs.de = HIGH_SCORE + 2;

  renderBcdColumnFixedCell(m);
}
