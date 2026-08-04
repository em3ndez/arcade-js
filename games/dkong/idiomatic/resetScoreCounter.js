// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetScoreCounter — zero one of the three score counters, then repaint it.
 *
 * The main-loop task ring dispatches this with a payload byte that picks which counter to reset:
 *   • payload 0 — player 1's score;
 *   • payload 2 — the high score;
 *   • anything else below 3 (i.e. 1) — player 2's score.
 *
 * Each score is a 3-byte little-endian packed-BCD counter. This routine zeroes all three bytes of
 * the selected counter and then hands off to the score-draw task, which repaints that counter —
 * now reading 000000 — up its own column. It is the clear-first twin of that draw task: the same
 * payload-to-counter selection, but the counter is BLANKED before it is rendered. This is the
 * score reset that happens when a game starts; nothing resets a score during attract, which only
 * redraws.
 *
 * A payload of 3 or more selects a recursive arm that clears the lower counters as well. Nothing
 * in play ever raises a payload above 2, and that arm was never lifted, so it surfaces here as a
 * loud fault rather than a silently wrong clear.
 *
 * The score-draw task takes its selecting payload in a register — a genuine task-ring boundary —
 * so the payload is left exactly where the ring delivered it, untouched by the clear.
 *
 * LIVE-OUT: memory-only — the three cleared counter bytes, plus the digit cells the repaint puts
 * into video RAM.
 */

import { P1_SCORE, P2_SCORE, HIGH_SCORE } from "./names.js";
import { drawScoreTask } from "./drawScoreTask.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

export function resetScoreCounter(m) {
  const { regs, mem } = m;
  const payload = regs.a;

  // Payload 3-and-up -> the un-lifted recursive "clear the lower counters too" arm. Never
  // enqueued in play; faulted loudly rather than mis-cleared.
  if (payload >= 3) {
    throw new NotImplemented(
      "resetScoreCounter payload>=3 recursion at ROM 0x05BD (twin-consistent stub; see the header)",
    );
  }

  // Select the 3-byte packed-BCD counter this task resets, by payload:
  //   0 -> player 1, 2 -> high score, anything else (1) -> player 2.
  const base = payload === 0 ? P1_SCORE : payload === 2 ? HIGH_SCORE : P2_SCORE;

  // Zero the whole counter (base, base+1, base+2) so it repaints as 000000.
  mem.write8(base, 0);
  mem.write8(base + 1, 0);
  mem.write8(base + 2, 0);

  // Repaint the now-cleared counter. The draw task reads the selecting payload from the same
  // register it arrived in, left untouched by the clear, and renders the six digits up the
  // counter's column.
  drawScoreTask(m);
}
