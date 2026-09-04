// SPDX-License-Identifier: GPL-3.0-only
import { clearScreen } from "./clearScreen.js";
import { drawScoreHeader } from "./drawScoreHeader.js";
import { drawPlayer1Score } from "./drawPlayer1Score.js";
import { drawPlayer2Score } from "./drawPlayer2Score.js";
import { drawHighScore } from "./drawHighScore.js";
import { drawCreditLabel } from "./drawCreditLabel.js";
import { drawCreditCount } from "./drawCreditCount.js";

/**
 * redrawScorePanel — repaint the whole score panel from scratch.
 *
 * WHAT IT IS
 *   Wipes video RAM and lays the fixed score panel back down: the score header line, both players'
 *   scores, the high score, the CREDIT label, and the running credit count.
 *
 * ROLE IN THE MACHINE
 *   Called at cold boot (bootInit runs it after seeding work RAM) and during attract to establish the
 *   static top-of-screen readout (mechanisms.md, boot/attract). clearScreen (0x1a5c) zeros the video
 *   window 0x2400..0x3fff; each draw helper then blits its piece to its own fixed screen address
 *   (drawScoreHeader/drawPlayer1Score/drawPlayer2Score/drawHighScore each render via drawScoreRecord
 *   or drawSpriteList, drawCreditLabel/drawCreditCount paint the credit readout). The tail into
 *   drawCreditCount collapses to a plain omitted-ret leaf.
 *
 * ROM 0x1956.  Grounding: [seen].
 *
 * LIVE-OUT: RAM/video only (callers ignore the register result).
 */
export function redrawScorePanel(m) {
  // Blank the entire video window before repainting so no stale glyphs remain.
  clearScreen(m);
  // Lay the fixed header line, then each score field, at their own screen addresses.
  drawScoreHeader(m);
  drawPlayer1Score(m);
  drawPlayer2Score(m);
  drawHighScore(m);
  // Paint the credit readout: the CREDIT label, then the BCD credit tally (tail).
  drawCreditLabel(m);
  return drawCreditCount(m);
}
