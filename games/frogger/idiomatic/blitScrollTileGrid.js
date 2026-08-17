// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitScrollTileGrid — stamp a source block into VRAM as a grid of two-byte column pairs.
 *
 * Saves the source pointer and row count into scratch, then walks C columns: each column
 * copies B rows of a two-byte pair from the source down the destination at a 32-byte row
 * pitch, restarting the source at the top of every column, and advances the destination by
 * the column stride between columns. A count of zero runs its 8-bit loop a full 256 times.
 * The default entry takes its destination base from SCROLL_COPY_DEST_PTR; blitScrollTileGridAlt is the
 * alt entry into the same loop, differing only in the alt destination-base cell.
 * LIVE-OUT: memory-only.
 */
import { SCROLL_COPY_DEST_PTR, SCROLL_COPY_DEST_PTR_ALT, SCROLL_COPY_SRC_PTR, SCROLL_COPY_ROWCOUNT, SCROLL_COPY_COLUMN_STRIDE } from "./names.js";

const ROW_PITCH = 32;
const PAIR = 2;
const FULL_RUN = 256;

export function blitScrollTileGrid(m) {
  return copyScrollTileGrid(m, SCROLL_COPY_DEST_PTR);
}

export function blitScrollTileGridAlt(m) {
  return copyScrollTileGrid(m, SCROLL_COPY_DEST_PTR_ALT);
}

function copyScrollTileGrid(m, destBaseCell) {
  const { regs, mem8, mem16 } = m;
  const source = regs.de;
  const rowCount = regs.b;
  const colCount = regs.c;

  mem16[SCROLL_COPY_SRC_PTR] = source;
  mem8[SCROLL_COPY_ROWCOUNT] = rowCount;

  const rows = rowCount === 0 ? FULL_RUN : rowCount;
  const cols = colCount === 0 ? FULL_RUN : colCount;
  let dst = mem16[destBaseCell];
  for (let col = 0; col < cols; col++) {
    let d = dst;
    let s = source;
    for (let r = 0; r < rows; r++) {
      mem8[d] = mem8[s];
      mem8[(d + 1)] = mem8[(s + 1)];
      d = (d + ROW_PITCH) & 0xffff;
      s = (s + PAIR) & 0xffff;
    }
    dst = (d + mem8[SCROLL_COPY_COLUMN_STRIDE]) & 0xffff;
  }
}
