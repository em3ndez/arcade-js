// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimTileColumns — the shared frog-animation tile-column render loop. Each arm hands over a
 * row-advance / row-count / column-count triple, a VRAM destination, a tile source, and two plot cursors.
 * For each column it computes the on-screen column index, stamps the negated index as a sprite X unless
 * plotting is suppressed, copies the tile-rows, advances the destination, then hands to the index advance.
 * Params default to the register the arm set; `borrow` is threaded per column off the destination add's
 * 16-bit overflow (so only the destination is held to 16 bits). LIVE-OUT: memory-only.
 */
import {
  TWO_PLAYER_START_FLAG,
  SCROLL_COPY_ROWCOUNT,
  SCROLL_COPY_SRC_PTR,
  SCROLL_COPY_COLUMN_STRIDE,
} from "./names.js";
import { computeVramColumnIndex } from "./computeVramColumnIndex.js";
import { advanceFrogAnimIndexAndRedispatch } from "./advanceFrogAnimIndexAndRedispatch.js";
import { u16 } from "../../../core/int.js";

const TILE_ROW_STRIDE = 0x20; // one screen row apart

// prettier-ignore
export function renderFrogAnimTileColumns(m, rowCount = m.regs.b, columnCount = m.regs.c, dest = m.regs.hl, source = m.regs.de, ixCursor = m.regs.ix, iyCursor = m.regs.iy, borrow = m.regs.fC ? 1 : 0) {
  const { mem8, mem16 } = m;

  let dst = dest;
  let src = source;
  let rowsPerColumn = rowCount;
  let columnsLeft = columnCount; // outer column counter; 0 wraps to 256
  let ix = ixCursor;

  for (;;) {
    const screenColumn = computeVramColumnIndex(m, dst, borrow);

    if (mem8[TWO_PLAYER_START_FLAG] === 0) {
      mem8[ix + 1] = -screenColumn;
      ix = ix + 1;
      mem8[iyCursor] = mem8[iyCursor] + 1;
    }

    // copy the tile-rows, two bytes each, stepping down one screen row per row
    mem8[SCROLL_COPY_ROWCOUNT] = rowsPerColumn;
    let cell = dst;
    let rows = rowsPerColumn & 0xff;
    for (;;) {
      mem8[cell] = mem8[src];
      mem8[cell + 1] = mem8[src + 1];
      cell = cell + TILE_ROW_STRIDE; // down one screen row
      rows = (rows - 1) & 0xff;
      if (rows === 0) break;
      src = src + 2; // step the source to the next tile-pair
    }

    // advance the destination; the add's 16-bit overflow is the next column's borrow
    const advanced = cell + mem8[SCROLL_COPY_COLUMN_STRIDE];
    dst = u16(advanced);
    borrow = advanced === dst ? 0 : 1;

    columnsLeft = (columnsLeft - 1) & 0xff;
    if (columnsLeft === 0) break;

    src = mem16[SCROLL_COPY_SRC_PTR];
    rowsPerColumn = mem8[SCROLL_COPY_ROWCOUNT];
  }

  return advanceFrogAnimIndexAndRedispatch(m);
}
