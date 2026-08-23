// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  COLUMN_BLIT_TILE_SRC,
  COLUMN_BLIT_ATTR_SRC,
  COLUMN_BLIT_TILE_DEST,
  COLUMN_BLIT_ATTR_DEST,
} from "./names.js";
/**
 * loc_0cf8 — stamp a two-plane column strip into video RAM.
 *
 * Walks a source table of 0x0c-byte columns, writing each column bottom-up (row stride 0x20) into
 * the tile-code plane from the tile destination. A steering byte follows each column: 0xff switches
 * to the attribute table and the attribute-plane destination, 0xee ends the stamp, anything else is
 * the first byte of the next column one cell to the right.
 *
 * LIVE-OUT: none — the written video-RAM cells are the whole effect; no register is read back.
 */
export function loc_0cf8(m) {
  const { mem8 } = m;

  let src = COLUMN_BLIT_TILE_SRC;
  let colTop = COLUMN_BLIT_TILE_DEST;
  for (;;) {
    let dest = colTop;
    for (let n = 0x0c; n > 0; n--) {
      mem8[dest] = mem8[src];
      src = u16(src + 1);
      dest = u16(dest - 0x20); // up one video-RAM row
    }
    const marker = mem8[src];
    if (marker === 0xff) {        // switch to the attribute plane
      src = COLUMN_BLIT_ATTR_SRC;
      colTop = COLUMN_BLIT_ATTR_DEST;
      continue;
    }
    if (marker === 0xee) return;  // end-of-stamp marker
    colTop = u16(colTop + 1);     // next column, one cell right
  }
}
