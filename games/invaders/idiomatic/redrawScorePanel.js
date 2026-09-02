// SPDX-License-Identifier: GPL-3.0-only
import { clearScreen } from "./clearScreen.js";
import { drawScoreHeader } from "./drawScoreHeader.js";
import { drawPlayer1Score } from "./drawPlayer1Score.js";
import { drawPlayer2Score } from "./drawPlayer2Score.js";
import { drawHighScore } from "./drawHighScore.js";
import { drawCreditLabel } from "./drawCreditLabel.js";
import { drawCreditCount } from "./drawCreditCount.js";

// Boot/attract score-panel repaint: clear video RAM, then redraw the score header, both player scores,
// the high score, the CREDIT label, and the credit tally (tail). Every call is a direct idiomatic call;
// the tail into drawCreditCount collapses to a plain omitted-ret leaf.
export function redrawScorePanel(m) {
  clearScreen(m);
  drawScoreHeader(m);
  drawPlayer1Score(m);
  drawPlayer2Score(m);
  drawHighScore(m);
  drawCreditLabel(m);
  return drawCreditCount(m);
}
