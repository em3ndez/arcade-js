// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreTask — repaint one of the three on-screen score readouts, chosen by the payload:
 * 0 -> player 1, 1 -> player 2, 2 -> high score, 3 -> an un-lifted clear-and-redraw arm (faults);
 * any other nonzero value falls in with player 2. Each score is a 3-byte packed-BCD counter stored
 * least-significant pair first, so the source pointer is set to base+2 (the top pair) before the
 * shared column renderer walks it top-down. The high-score arm needs no pointer.
 *
 * LIVE-OUT: memory-only — the digit cells the renderer paints into video RAM.
 */

import { P1_SCORE, P2_SCORE } from "./names.js";
import { loc_056b } from "./loc_056b.js";
import { drawHighScore } from "./drawHighScore.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

export function drawScoreTask(m, a = m.regs.a) {
  const { regs } = m;
  const payload = a;

  if (payload === 3) {
    throw new NotImplemented("drawScoreTask payload 3 path at ROM 0x05E0 (un-lifted arm)");
  }

  if (payload === 2) {
    drawHighScore(m);
    return;
  }

  regs.de = (payload === 0 ? P1_SCORE : P2_SCORE) + 2;

  loc_056b(m);
}
