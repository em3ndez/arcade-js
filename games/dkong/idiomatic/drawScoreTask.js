// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreTask — the score-counter draw task: repaint one of the three on-screen score
 * readouts, chosen by the task payload.  ROM 0x05C6.
 *
 * Dispatched from the main-loop task ring (dispatchTask hands the task's second byte
 * to the handler as its payload). The payload selects which counter to redraw and
 * where:
 *   • payload 0 — player 1's score, rendered up its column;
 *   • payload 1 — player 2's score, rendered up its column;
 *   • payload 2 — the high score, rendered up its fixed column;
 *   • any other nonzero value falls in with player 2's counter (the zero/nonzero
 *     column selector treats it the same), matching the oracle's single equality
 *     tests rather than a range check.
 *
 * Each score is a 3-byte little-endian packed-BCD counter; the renderer walks it from
 * its most-significant pair, so this routine points the source at score-base + 2 and
 * hands off to the shared column renderer. The high-score arm instead uses the
 * dedicated fixed-column tail, which sources the record itself.
 *
 * The payload-3 arm jumps to a separate ROM routine (0x05E0) that clears-and-redraws a
 * counter; it is never enqueued in play (attract only ever raises payloads 0 and 2)
 * and was never lifted, so — exactly as the frozen oracle does — it surfaces as a loud
 * fault rather than a silent wrong render.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callees promote their live-ins): both
 * renderers still take their inputs in registers, so this routine loads what the
 * oracle's dispatch sites load — the source pointer for the column renderer (the high
 * score arm needs none; drawHighScore overrides the source itself), and it leaves the
 * payload in place as the renderer's column selector.
 *
 * NAME (promoted, DK understanding pass 7 — independent proposer≠confirmer): the
 * select-a-score-and-render task. The MECHANISM is pinned to the oracle and the three
 * payload sources are the rated P1_SCORE / P2_SCORE / HIGH_SCORE cells (payload 0 → P1,
 * 1/other → P2, 2 → high), so "draw the score counter for this task" is grounded. The
 * task-ring dispatch (payload = the task's second byte) is oracle-pinned.
 *
 * Memory-equivalent to the frozen oracle — equivalence-05c6.test.js.
 * GATE:     crafted-entry, grounded in real captured RAM. Attract dispatches 0x05C6
 *           (payloads 0 and 2 seen), so real captured dispatches ground the two render
 *           arms; crafted entries then force the player-2 arm (payload 1) and a
 *           higher payload identically on both sides over differing-nibble score bytes,
 *           and confirm the payload-3 arm faults on both sides. Compared over RAM (minus
 *           STACK_SCRATCH) + pc + SP + reproduced registers. Teeth: a twin that swaps
 *           the player-1/player-2 source and a twin that renders the high score through
 *           the column selector instead of its fixed-column tail.
 * LIVE-OUT: memory-only — the six digit cells the renderer paints into video RAM. The
 *           task returns to the top of the main loop, which reloads its registers, so
 *           the oracle's residual registers/flags are dead; they are reproduced here
 *           only for extra teeth.
 * NAMES:    P1_SCORE (0x60B2), P2_SCORE (0x60B5) from ram.js — the source is that base
 *           plus 2 (the most-significant BCD pair). The high score's source and all
 *           three destination columns are owned by the callees. loc_056b (ROM 0x056B)
 *           and drawHighScore (ROM 0x05DA) are direct-called.
 */

import { P1_SCORE, P2_SCORE } from "./ram.js";
import { loc_056b } from "./loc_056b.js"; // ROM 0x056B — column-selecting BCD renderer
import { drawHighScore } from "./drawHighScore.js"; // ROM 0x05DA — fixed-column high-score tail
import { NotImplemented } from "../../../boards/dkong/io.js";

export function drawScoreTask(m) {
  const { regs } = m;
  const payload = regs.a;

  // Payload 3 -> the un-lifted clear-and-redraw arm at ROM 0x05E0. Never enqueued in
  // play; faulted loudly rather than mis-rendered, matching the oracle.
  if (payload === 3) {
    throw new NotImplemented("drawScoreTask payload 3 path at ROM 0x05E0 (un-lifted arm)");
  }

  // Payload 2 -> repaint the high score from the record itself up its fixed column.
  // Its tail overrides the source, so no source pointer is marshalled here.
  if (payload === 2) {
    drawHighScore(m);
    return;
  }

  // Payload 0 -> player 1's score; anything else -> player 2's score. Point the source
  // at the counter's most-significant BCD pair so the renderer walks the three bytes
  // top-down.
  regs.de = (payload === 0 ? P1_SCORE : P2_SCORE) + 2;

  // The column renderer reads the payload as its zero/nonzero column selector and the
  // source pointer above, then paints the six digits up the chosen column.
  loc_056b(m);
}
