// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreTask — repaint one of the three on-screen score readouts, chosen by the task's payload.
 *
 * The payload arrives in a register and picks the counter:
 *   - payload 0 — player 1's score, up its own column;
 *   - payload 1 — player 2's score, up its own column;
 *   - payload 2 — the high score, up its fixed column;
 *   - any other non-zero value falls in with player 2's counter, because the arms are single
 *     equality tests and the column selector only asks zero-or-not.
 *
 * Each score is a three-byte counter of packed digit pairs, stored least-significant pair first,
 * and the renderer walks it from the TOP. So the source pointer is set to the counter's base plus
 * two — its most-significant pair — before handing off to the shared column renderer. The
 * high-score arm needs no pointer: its own tail knows where the record is.
 *
 * Payload 3 selects a clear-and-redraw arm that this file does not implement. It faults loudly
 * rather than quietly rendering the wrong thing.
 *
 * Both renderers take their inputs in registers, so the source pointer is left in one, and the
 * payload is left where it lies to serve as the column selector.
 *
 * LIVE-OUT: memory-only — the digit cells the renderer paints into video RAM.
 */

import { P1_SCORE, P2_SCORE } from "./names.js";
import { loc_056b } from "./loc_056b.js";
import { drawHighScore } from "./drawHighScore.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

export function drawScoreTask(m) {
  const { regs } = m;
  const payload = regs.a;

  // Payload 3 selects the clear-and-redraw arm, which this file does not implement.
  if (payload === 3) {
    throw new NotImplemented("drawScoreTask payload 3 path at ROM 0x05E0 (un-lifted arm)");
  }

  // Payload 2 -> repaint the high score up its fixed column. Its tail finds the record itself, so
  // no source pointer is set here.
  if (payload === 2) {
    drawHighScore(m);
    return;
  }

  // Payload 0 -> player 1's score; anything else -> player 2's. Point the source at the counter's
  // most-significant digit pair so the renderer walks the three bytes top-down.
  regs.de = (payload === 0 ? P1_SCORE : P2_SCORE) + 2;

  // The column renderer takes the payload as its zero-or-not column selector and the source
  // pointer above, then paints the six digits up the chosen column.
  loc_056b(m);
}
