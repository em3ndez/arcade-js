// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGirderSpan — fill a board-layout segment's body run with the uniform tile 0xC0,
 * then draw its end cap.
 *
 * DESPITE THE NAME, WHAT THIS LAYS DOWN IS LADDER. Blanking its tile writes and
 * diffing the frame removes 616 px, and they are the LADDERS — the two full-height
 * ladders beside Kong plus eight shorter segments. Not one girder pixel changes.
 *
 * The board-layout walk hands this routine a write pointer already aimed at the
 * segment's first tilemap cell, and a span counter, SEG_RUN, holding the run's pixel
 * extent. This is the BODY FILL: it walks the pointer along the segment, stamping the
 * body tile 0xC0 into one cell per 8-px step, until the span is spent.
 *
 * WHICH WAY THE RUN GOES ON SCREEN. The pointer advances by +1, i.e. along the raw
 * tilemap COLUMN axis (index = row*32 + col). The display is rotated a quarter turn,
 * so that raw column axis is the DISPLAYED VERTICAL and the raw row axis the displayed
 * horizontal: on screen these are SHORT VERTICAL runs, the opposite of what the
 * raw-axis reading suggests.
 *
 *   - The counter LIVES IN MEMORY at SEG_RUN. Each step reloads it, subtracts 8 (one
 *     tile), and stores it back; when that subtraction borrows — the span has dropped
 *     below 8 — the run is done. The store happens before the borrow test, so the
 *     final (borrowed) value is written too. Keeping the counter in memory rather than
 *     in a local reproduces every value the hardware leaves at SEG_RUN.
 *   - The write pointer advances by its low byte only, so the walk wraps within the
 *     256-cell tilemap page and never crosses into the next row's high byte.
 *
 * On exit it draws the segment's END CAP, which stamps the far-endpoint tiles and
 * advances the layout table cursor.
 *
 * LIVE-OUT: memory (the tilemap cells and the SEG_RUN counter) plus the advanced table
 * cursor, which the layout walk reads first thing on its next record.
 */

import { drawSegmentEndCap } from "./drawSegmentEndCap.js";
import { SEG_RUN } from "./names.js";

export function drawGirderSpan(m) {
  const { regs, mem } = m;

  // Body fill: step the span counter down one tile (8 px) at a time, stamping the
  // body tile 0xC0, until the subtraction borrows (the span drops below 8).
  for (;;) {
    const span = mem.read8(SEG_RUN);
    mem.write8(SEG_RUN, (span - 0x08) & 0xff); // store back every step, borrow or not
    if (span < 0x08) break; // borrowed -> span exhausted
    regs.l = (regs.l + 1) & 0xff; // advance one cell within the tilemap page
    mem.write8(regs.hl, 0xc0); // stamp the body tile
  }

  // End cap: stamp the far-endpoint tiles and advance the layout table cursor.
  drawSegmentEndCap(m);
}
