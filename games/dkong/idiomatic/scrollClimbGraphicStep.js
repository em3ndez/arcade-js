// SPDX-License-Identifier: GPL-3.0-only
/**
 * scrollClimbGraphicStep — move one indexed pair of playfield cells up a row and step the
 * cutscene's scroll index down.
 *
 * The opening Kong-climb intro animates by sliding a strip of the playfield up the screen a
 * tilemap row at a time. This routine is ONE cell-pair of that slide. It reads the scroll index
 * and uses it as the offset into two fixed video cell columns, two rows apart, copying each
 * indexed cell to the cell one 32-column row above it. Then it steps the index down, so calling
 * this repeatedly walks the index down and slides a whole run of cells up a row, cell by cell.
 *
 * Both copies go through a shared displaced-copy primitive that takes a base, an index and a
 * signed displacement, and writes exactly one destination byte. It leaves the index and the
 * displacement alone, so they are set once here and both copies reuse them.
 *
 * For every index the routine can see (0..255), both source and destination land wholly inside
 * video RAM, so the address arithmetic never wraps in practice.
 *
 * LIVE-OUT: memory-only — the two copied video bytes and the decremented scroll index.
 */

import { copyByteDisplaced } from "./copyByteDisplaced.js";
import { INTRO_SCROLL_INDEX } from "./names.js";

const ROW = 0xffe0; // one 32-column tilemap row, upward

export function scrollClimbGraphicStep(m) {
  const { regs, mem } = m;

  // The scroll index picks which cell of each column moves this call.
  regs.bc = mem.read8(INTRO_SCROLL_INDEX);
  // Set once and reused by both copies.
  regs.de = ROW;

  // Copy each indexed cell up one row.
  regs.hl = 0x7600;
  copyByteDisplaced(m);
  regs.hl = 0x75c0;
  copyByteDisplaced(m);

  // Step the scroll index down (it wraps at a byte). The copies never touch it, so this reads
  // back the same index just used.
  mem.write8(INTRO_SCROLL_INDEX, (mem.read8(INTRO_SCROLL_INDEX) - 1) & 0xff);
}
