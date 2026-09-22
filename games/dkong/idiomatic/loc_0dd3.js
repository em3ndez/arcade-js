// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd3 — convert a segment record's second endpoint, compute its run deltas, and draw the
 * segment.
 *
 * The tail of the playfield-record walk (first point already converted). Kinds ≥2 draw a
 * girder span; kinds 0/1 fold the sub-tile x into the run, stamp two cap tiles, and draw a
 * ladder (kind 1 zeroes the run first).
 *
 * LIVE-OUT: memory (segment scratch cells + stamped tiles) plus the record pointer the walk
 * reads as the next record's address.
 */

// The seam entry marshals the register file to the pure (y, x) leaf.
import { u16 } from "../../../core/int.js";
import { tileAddrForPixel, tileAddrForPixelFromRegisters } from "./tileAddrForPixel.js";
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

export function loc_0dd3(m, a = m.regs.a, c = m.regs.c, de = m.regs.de) {
  const { mem8, mem16 } = m;

  // The accumulator arrives holding the segment's height.
  mem8[SEG_HEIGHT] = a;

  // Second point's x: run = difference of the two x values, sub-tile = its low 3 bits.
  de = u16(de + 1);
  const x2 = mem8[de];
  mem8[SEG_RUN] = (x2 - c);
  mem8[SEG_SUBTILE2] = x2 & 0x07;

  // Convert the second point to a tile address (the record pointer is safe in the `de` local). The
  // y arrives in H (the caller kept it there for the frozen leaf); hand (y, x) to the converter as
  // arguments, and take SEG_ADDR2 from the pure leaf — it equals the HL the converter leaves.
  const y = m.regs.h;
  tileAddrForPixelFromRegisters(m, y, x2);
  mem16[SEG_ADDR2] = tileAddrForPixel(y, x2);

  // Hand the record cursor to the drawers, which read regs.de and step it to the next record.
  m.regs.de = de;

  // Dispatch on record kind. This is a SIGN test, not an unsigned compare; the two agree only
  // because real kinds are small.
  const kind = mem8[SEG_KIND];
  if ((((kind - 0x02) & 0xff) & 0x80) === 0) {
    drawGirderSpan(m);
    return;
  }

  // Kinds 0 and 1: fold the second point's sub-tile x into the run before the span fill.
  const step = (mem8[SEG_RUN] - 0x10) & 0xff;
  mem8[SEG_RUN] = (mem8[SEG_SUBTILE1] + step);

  // Stamp the two endpoint-cap tiles at the first point's address (the +1 step wraps in-page).
  const cap1 = (mem8[SEG_SUBTILE1] + 0xf0) & 0xff;
  let hl = mem16[SEG_ADDR1];
  mem8[hl] = cap1;
  hl = hl - (hl & 0xff) + ((hl + 1) & 0xff); // inc l — low byte only, wraps within the page
  mem8[hl] = (cap1 - 0x30);

  // Kind 1 zeroes the run, so no span is laid — just the two caps.
  if (mem8[SEG_KIND] === 0x01) {
    mem8[SEG_RUN] = 0x00;
  }

  // drawLadder reads HL (and L = its low byte) as its write cursor — handed in as an argument.
  drawLadder(m, hl);
}
