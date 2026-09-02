// SPDX-License-Identifier: GPL-3.0-only
import { clearGameActive } from "./clearGameActive.js";
import { drawCreditCount } from "./drawCreditCount.js";
import { drawCreditLabel } from "./drawCreditLabel.js";

// Clear the game-active flag, repaint the credit tally, then draw the credit label (tail).
export function drawCreditReadout(m) {
  clearGameActive(m);
  drawCreditCount(m);
  return drawCreditLabel(m);
}
