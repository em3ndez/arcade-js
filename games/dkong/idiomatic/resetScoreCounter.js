// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetScoreCounter — zero one of the three 3-byte packed-BCD score counters (payload picks it:
 * 0 = P1, 2 = high score, else P2), then repaint it. Payload >= 3 is the un-lifted recursive arm.
 *
 * LIVE-OUT: memory-only — the three cleared counter bytes, plus the digit cells the repaint puts
 * into video RAM.
 */

import { P1_SCORE, P2_SCORE, HIGH_SCORE } from "./names.js";
import { drawScoreTask } from "./drawScoreTask.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

export function resetScoreCounter(m, payload = m.regs.a) {
  const { mem8 } = m;

  if (payload >= 3) {
    throw new NotImplemented(
      "resetScoreCounter payload>=3 recursion (twin-consistent stub; see the header)",
    );
  }

  const base = payload === 0 ? P1_SCORE : payload === 2 ? HIGH_SCORE : P2_SCORE;

  mem8[base] = 0;
  mem8[base + 1] = 0;
  mem8[base + 2] = 0;

  drawScoreTask(m, payload);
}
