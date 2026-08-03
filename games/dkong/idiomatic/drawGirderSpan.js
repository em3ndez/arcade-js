// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawGirderSpan — fill a layout segment's body run with the girder tile 0xC0,
 * then draw its end cap.  ROM 0x0e19.
 *
 * The board-layout renderer sub_0da7 walks a table of segment records (girders and
 * the like); for each, loc_0dd3 converts the two endpoints and sets up the write
 * pointer HL (the first point's tilemap cell) and the span counter SEG_RUN (0x63B2, the
 * run's pixel extent). This routine is the BODY FILL: it walks HL across the segment,
 * stamping the girder body tile 0xC0 into one cell per 8-px step, until the span is
 * spent. Its ROM sibling loc_0e4f is the vertical counterpart; this one runs ACROSS.
 *
 *   - The counter LIVES IN MEMORY at SEG_RUN (0x63B2). Each step reloads it, subtracts 8
 *     (one tile), and stores it back; when that `sub 0x08` borrows — the span has dropped
 *     below 8 — the run is done. The store happens before the borrow test, so the
 *     final (borrowed) value is written too; keeping the counter in memory rather
 *     than a JS local reproduces every value the ROM leaves at SEG_RUN.
 *   - HL advances by `inc l` (low byte only), so the walk wraps within the 256-cell
 *     tilemap page and never crosses into the next row's high byte.
 *
 * On exit it draws the segment's END CAP: in the ROM the loop's borrow arm tail-jumps
 * into loc_0e2a (whose own tail re-enters sub_0da7's walk). Here that is a direct call
 * to loc_0e2a's already-decompiled twin, drawSegmentEndCap, which stamps the far-
 * endpoint tiles and advances the table cursor DE.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0e19.test.js.
 * GATE:     crafted-entry; REACHED in attract (loc_0dd3 m.call's it during board-layout
 *           draw). Real captured dispatches + crafted entries forcing the multi-cell,
 *           single-cell, and immediate-borrow (zero-cell) span lengths identically on
 *           both sides. Teeth = a wrong body tile (0xC1 not 0xC0).
 * LIVE-OUT: memory (VRAM tile cells + the SEG_RUN counter) + DE, advanced past the record
 *           by the end cap — the successor 0x0DA7 does `ld a,(de)` first thing. SP is
 *           unchanged (no stack use) and IS compared. A/HL are dead at the tail (the end
 *           cap and then 0x0DA7 overwrite them) so they are neither reproduced nor
 *           compared; pc is the structural tail into the end cap and is not compared.
 * NAMES:    SEG_RUN (0x63B2) from ram.js — the segment run/span counter (line-segment
 *           render scratch); 0xC0 is the girder body tile code.
 */

import { drawSegmentEndCap } from "./drawSegmentEndCap.js";
import { SEG_RUN } from "./ram.js";

export function drawGirderSpan(m) {
  const { regs, mem } = m;

  // Body fill: step the span counter down one tile (8 px) at a time, stamping the
  // girder body tile 0xC0, until `sub 0x08` borrows (the span drops below 8).
  for (;;) {
    const span = mem.read8(SEG_RUN);
    mem.write8(SEG_RUN, (span - 0x08) & 0xff); // store back every step, borrow or not
    if (span < 0x08) break; // `sub 0x08` borrowed -> span exhausted
    regs.l = (regs.l + 1) & 0xff; // `inc l` -- advance one cell within the tilemap page
    mem.write8(regs.hl, 0xc0); // stamp the girder body tile
  }

  // End cap: stamp the far-endpoint tiles and advance the table cursor DE.
  drawSegmentEndCap(m);
}
