// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd3 — convert a segment record's second endpoint, compute its run deltas, and draw the
 * segment.
 *
 * The tail of the playfield-record walk. Each record is a line segment; the first point is
 * already converted (SEG_ADDR1/SEG_SUBTILE1). This stores the height, reads the second x to
 * derive SEG_RUN and SEG_SUBTILE2, converts the second point to SEG_ADDR2, then dispatches on
 * the record kind: kinds ≥2 go straight to drawGirderSpan; kinds 0/1 fold the sub-tile x into
 * the run, stamp the two endpoint-cap tiles, zero the run for kind 1, and draw the ladder.
 *
 * LIVE-OUT: memory (the segment scratch cells and the tiles the drawers stamp) plus the record
 * pointer, which the walk reads as the next record's address and which no memory write here
 * depends on.
 */

// Imported in its guest-stack-consuming address-layer form on purpose: not interchangeable with
// a direct call, which would leave the guest stack one word off.
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { drawGirderSpan } from "./drawGirderSpan.js";
import { drawLadder } from "./drawLadder.js";

// Board-render line-segment scratch (SEG_SUBTILE1 / SEG_ADDR1 / SEG_KIND set before entry).
import {
  SEG_HEIGHT,
  SEG_RUN,
  SEG_SUBTILE2,
  SEG_ADDR2,
  SEG_SUBTILE1,
  SEG_ADDR1,
  SEG_KIND,
} from "./names.js";

export function loc_0dd3(m, a = m.regs.a, c = m.regs.c) {
  const { regs, mem8, mem16 } = m;

  // The accumulator arrives holding the segment's height.
  mem8[SEG_HEIGHT] = a;

  // Step to the second point's x: the run is the difference of the two x values, and its low
  // three bits are the second point's sub-tile position.
  regs.de = (regs.de + 1) & 0xffff;
  const x2 = mem8[regs.de];
  regs.l = x2;
  mem8[SEG_RUN] = (x2 - c) & 0xff;
  mem8[SEG_SUBTILE2] = x2 & 0x07;

  // Convert the second point to a tile address. The conversion clobbers the record pointer, so
  // save and restore it — the drawers below step it on to the next record.
  const savedDe = regs.de;
  loc_2ff0(m);
  regs.de = savedDe;
  mem16[SEG_ADDR2] = regs.hl;

  // Dispatch on record kind. This is a SIGN test, not an unsigned compare; the two agree only
  // because real kinds are small.
  const kind = mem8[SEG_KIND];
  if ((((kind - 0x02) & 0xff) & 0x80) === 0) {
    drawGirderSpan(m);
    return;
  }

  // Kinds 0 and 1: fold the second point's sub-tile x into the run before the span fill.
  const step = (mem8[SEG_RUN] - 0x10) & 0xff;
  mem8[SEG_RUN] = (mem8[SEG_SUBTILE1] + step) & 0xff;

  // Stamp the two endpoint-cap tiles at the first point's address. The step to the next cell
  // wraps within the page rather than carrying, and the address is left for the span fill.
  const cap1 = (mem8[SEG_SUBTILE1] + 0xf0) & 0xff;
  regs.hl = mem16[SEG_ADDR1];
  mem8[regs.hl] = cap1;
  regs.l = (regs.l + 1) & 0xff;
  mem8[regs.hl] = (cap1 - 0x30) & 0xff;

  // Kind 1 zeroes the run, so no span is laid — just the two caps.
  if (mem8[SEG_KIND] === 0x01) {
    mem8[SEG_RUN] = 0x00;
  }

  drawLadder(m);
}
