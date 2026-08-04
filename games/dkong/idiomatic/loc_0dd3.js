// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd3 — convert a segment record's second endpoint, compute its run deltas, and draw the
 * segment.
 *
 * The tail of the playfield-record walk. Each record is a LINE SEGMENT between two points; the
 * walk has already converted the FIRST point to a tile address in SEG_ADDR1 and stashed its
 * sub-tile x in SEG_SUBTILE1, and it enters here with the segment's height in the accumulator, the
 * second point's y and the first point's x in registers, and the record pointer just short of the
 * second point's x. This routine:
 *
 *   1. Stores the height counter into SEG_HEIGHT.
 *   2. Steps the record pointer to the second x and reads it; the difference between the two x
 *      values becomes SEG_RUN, the horizontal run, and the low three bits of the second x become
 *      SEG_SUBTILE2, its sub-tile position.
 *   3. Converts the second point to a tile address in SEG_ADDR2. The record pointer is saved and
 *      restored around that conversion, which clobbers it — and the restore is load-bearing,
 *      because the drawers below step that pointer on to the next record.
 *   4. Dispatches on the record kind:
 *        - kind 2 and above: hand the segment straight to the drawer for those kinds.
 *        - kinds 0 and 1: finish the setup first — fold the second point's sub-tile x into the
 *          run, stamp the segment's two endpoint-cap tiles into the first point's cell and the one
 *          after it, and for kind 1 zero the run so no span at all is laid — then draw.
 *
 * The kind test is a SIGN test rather than an unsigned compare; the two agree only because real
 * kinds are small.
 *
 * LIVE-OUT: memory (the segment scratch cells and the tiles the drawers stamp) plus the record
 * pointer, which the walk reads as the next record's address and which no memory write here
 * depends on.
 */

// The pixel-to-tile-address conversion is imported in its address-layer form ON PURPOSE: the two
// forms are not interchangeable here, because the address-layer one consumes a guest-stack word
// that a direct call does not, and nothing available to this file can tell the difference.
import { loc_2ff0 } from "../translated/loc_2ff0.js";
import { drawLadder } from "./drawLadder.js";
import { drawGirderSpan } from "./drawGirderSpan.js";

// Board-render line-segment scratch:
//   SEG_HEIGHT    the segment's height/length counter
//   SEG_RUN       the horizontal run, paid down one tile's width at a time by the span fill
//   SEG_SUBTILE2  the second point's sub-tile x
//   SEG_ADDR2     tile address of the second point
//   SEG_SUBTILE1  the first point's sub-tile x, set before entry
//   SEG_ADDR1     tile address of the first point, set before entry
//   SEG_KIND      record kind / dispatch selector, set before entry
import {
  SEG_HEIGHT,
  SEG_RUN,
  SEG_SUBTILE2,
  SEG_ADDR2,
  SEG_SUBTILE1,
  SEG_ADDR1,
  SEG_KIND,
} from "./names.js";

export function loc_0dd3(m) {
  const { regs, mem } = m;

  // The accumulator arrives holding the segment's height: stash it as the counter.
  mem.write8(SEG_HEIGHT, regs.a);

  // Step the record pointer on to the second point's x and read it. The conversion below takes
  // that x in the low half of the pointer register; the run is the difference between the two x
  // values, and the low three bits are the second point's sub-tile position.
  regs.de = (regs.de + 1) & 0xffff;
  const x2 = mem.read8(regs.de);
  regs.l = x2;
  mem.write8(SEG_RUN, (x2 - regs.c) & 0xff);
  mem.write8(SEG_SUBTILE2, x2 & 0x07);

  // Convert the second point to a tile address. The conversion clobbers the record pointer, so
  // save and restore it around the call — the drawers below step it on to the next record.
  const savedDe = regs.de;
  loc_2ff0(m);
  regs.de = savedDe;
  mem.write16(SEG_ADDR2, regs.hl);

  // Dispatch on the record kind. This is a SIGN test, not an unsigned compare; the two agree only
  // because real kinds are small. The higher kinds go straight to their drawer, which reloads
  // what it needs and reads the record pointer itself.
  const kind = mem.read8(SEG_KIND);
  if ((((kind - 0x02) & 0xff) & 0x80) === 0) {
    drawLadder(m);
    return;
  }

  // -- kinds 0 and 1 --

  // Fold the second point's sub-tile x into the run before the span fill.
  const step = (mem.read8(SEG_RUN) - 0x10) & 0xff;
  mem.write8(SEG_RUN, (mem.read8(SEG_SUBTILE1) + step) & 0xff);

  // Stamp the segment's two endpoint-cap tiles at the first point's address: one code in the base
  // cell and a fixed offset from it in the next. The step to the next cell wraps within the page
  // rather than carrying, and the address is left there for the span fill.
  const cap1 = (mem.read8(SEG_SUBTILE1) + 0xf0) & 0xff;
  regs.hl = mem.read16(SEG_ADDR1);
  mem.write8(regs.hl, cap1);
  regs.l = (regs.l + 1) & 0xff;
  mem.write8(regs.hl, (cap1 - 0x30) & 0xff);

  // Kind 1 zeroes the run, so no span at all is laid — just the two caps.
  if (mem.read8(SEG_KIND) === 0x01) {
    mem.write8(SEG_RUN, 0x00);
  }

  drawGirderSpan(m);
}
