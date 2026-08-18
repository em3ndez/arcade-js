// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitScrollTileGrid  —  ROM 0x20cc  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The scrolling background's shared tile-copy engine. It stamps a block of ROM tile data into VRAM as a
 *   grid of two-byte column pairs: for each of C columns it copies B rows of a 16-bit tile pair straight
 *   DOWN the destination — one tilemap row (32 bytes) apart — then steps the destination sideways to the
 *   next column. This is the one loop every scroll re-stamp and every frog-animation render arm funnels
 *   through to actually touch the tilemap; it does no bookkeeping of its own beyond the copy.
 *
 * WHERE IT SITS
 *   Called by the per-frame scroll clock's lane re-stamp (advanceScrollLaneObjects, ROM 0x2005) at master
 *   phase marks 16/32/48 — once for scroll object A through the default entry, once for object B through
 *   the alt entry — and by the eleven frog-animation render arms, which pre-load the same scratch cells and
 *   then run this same body. The live-in values are the Z80 registers DE (source block), B (rows per
 *   column) and C (columns); that is why the default parameters below read m.regs.de / m.regs.b / m.regs.c.
 *
 * TWO ENTRIES, ONE LOOP
 *   blitScrollTileGrid (ROM 0x20cc) is the default entry: it takes its VRAM destination base from the ROM
 *   pointer word SCROLL_COPY_DEST_PTR (0x13ef), which points at VRAM 0xa808. blitScrollTileGridAlt (the ROM
 *   0x20bf second entry) is the identical loop reading its base from SCROLL_COPY_DEST_PTR_ALT (0x13f5)
 *   instead — so the lane re-stamp can paint object A and object B into two different VRAM regions from one
 *   shared copy body.
 *
 * LIVE-OUT
 *   Memory only. It parks the source pointer / row count in scratch (SCROLL_COPY_SRC_PTR 0x8001 as a word,
 *   SCROLL_COPY_ROWCOUNT 0x8003 as a byte), stamps the tile grid into VRAM, and returns nothing.
 */
import { SCROLL_COPY_DEST_PTR, SCROLL_COPY_DEST_PTR_ALT, SCROLL_COPY_SRC_PTR, SCROLL_COPY_ROWCOUNT, SCROLL_COPY_COLUMN_STRIDE } from "./names.js";

const ROW_PITCH = 32; // one tilemap row = 32 bytes; the destination steps down by this between rows
const PAIR = 2;       // each grid cell is a two-byte tile pair; the source steps forward by this between rows
const FULL_RUN = 256; // an 8-bit count of 0 does not skip the loop — it wraps to a full 256-iteration pass

// Default entry (ROM 0x20cc): destination base from SCROLL_COPY_DEST_PTR (0x13ef → VRAM 0xa808).
export function blitScrollTileGrid(m, source = m.regs.de, rowCount = m.regs.b, colCount = m.regs.c) {
  return copyScrollTileGrid(m, SCROLL_COPY_DEST_PTR, source, rowCount, colCount);
}

// Alt entry (ROM 0x20bf): the identical loop, destination base from SCROLL_COPY_DEST_PTR_ALT (0x13f5).
export function blitScrollTileGridAlt(m, source = m.regs.de, rowCount = m.regs.b, colCount = m.regs.c) {
  return copyScrollTileGrid(m, SCROLL_COPY_DEST_PTR_ALT, source, rowCount, colCount);
}

function copyScrollTileGrid(m, destBaseCell, source, rowCount, colCount) {
  const { mem8, mem16 } = m;

  // ── Park the copy parameters in scratch ─────────────────────────────────────────────
  // The ROM stows the source pointer in the word cell SCROLL_COPY_SRC_PTR (0x8001) and the row count in
  // SCROLL_COPY_ROWCOUNT (0x8003) because its inner loop reloads BOTH at the top of every column (each
  // column restarts the source at the block's top and re-counts the rows). These writes are observable RAM
  // state — part of this routine's live-out — so they stay; the JS loop below carries the same two values
  // in locals and so reproduces the "restart per column" semantics without re-reading the cells.
  mem16[SCROLL_COPY_SRC_PTR] = source;
  mem8[SCROLL_COPY_ROWCOUNT] = rowCount;

  // ── Zero means a full 8-bit pass ────────────────────────────────────────────────────
  // Both counts are single bytes the ROM decrements to zero, so a count byte of 0 is not an empty loop —
  // it runs the full 256 iterations. This applies independently to the row count and the column count.
  const rows = rowCount === 0 ? FULL_RUN : rowCount;
  const cols = colCount === 0 ? FULL_RUN : colCount;

  // ── Destination base ────────────────────────────────────────────────────────────────
  // Read the VRAM destination base from this entry's ROM pointer word: SCROLL_COPY_DEST_PTR (0x13ef, which
  // points at VRAM 0xa808) for the default entry, SCROLL_COPY_DEST_PTR_ALT (0x13f5) for the alt entry.
  // colDest is the running start-of-column pointer; it walks sideways by the column stride each column.
  let colDest = mem16[destBaseCell];

  for (let col = 0; col < cols; col++) {
    // Every column restarts the source at the top of the block (the ROM's per-column reload of
    // SCROLL_COPY_SRC_PTR) and paints straight down from this column's base cell.
    let destCell = colDest;
    let srcCell = source;

    for (let row = 0; row < rows; row++) {
      // Copy one two-byte tile pair, then step the destination DOWN one full tilemap row (ROW_PITCH = 32
      // bytes) and the source FORWARD by the pair width (2 bytes) to the next pair in the block.
      mem8[destCell] = mem8[srcCell];
      mem8[destCell + 1] = mem8[srcCell + 1];
      destCell += ROW_PITCH;
      srcCell += PAIR;
    }

    // ── Advance to the next column ─────────────────────────────────────────────────────
    // Step the destination sideways by the column-stride byte SCROLL_COPY_COLUMN_STRIDE (0x81b1), measured
    // from where the last row left off — so the scroll object's own stride byte controls column spacing.
    colDest = destCell + mem8[SCROLL_COPY_COLUMN_STRIDE];
  }
}
