// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawLadder — fill a board-layout segment's body run with the uniform tile 0xC0, then draw its
 * end cap. The counter lives in memory at SEG_RUN; the write pointer advances by its low byte
 * only, so the walk wraps within the 256-cell tilemap page.
 *
 * LIVE-OUT: memory (the tilemap cells and SEG_RUN) plus the advanced layout table cursor.
 */

import { drawSegmentEndCap } from "./drawSegmentEndCap.js";
import { SEG_RUN } from "./names.js";

export function drawLadder(m) {
  const { regs, mem8 } = m;

  for (;;) {
    const span = mem8[SEG_RUN];
    mem8[SEG_RUN] = (span - 0x08) & 0xff; // store back every step, borrow or not
    if (span < 0x08) break; // borrowed -> span exhausted
    regs.l = (regs.l + 1) & 0xff;
    mem8[regs.hl] = 0xc0;
  }

  drawSegmentEndCap(m);
}
