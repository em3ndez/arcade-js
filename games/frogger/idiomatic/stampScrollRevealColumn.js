// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampScrollRevealColumn — stamp a scroll-reveal column into VRAM for the scroll object.
 *
 * Builds a VRAM address from the object's row, column and row-count fields, then picks a
 * stamp table by the scroll-phase byte: two phases share one table, two share another and
 * clear an edge flag, one uses a third and sets that flag; any other phase stamps nothing.
 * Every path finishes by writing the object's row-count-minus-one mirror.
 * LIVE-OUT: memory-only.
 */
import { SCROLL_OBJECT_BLOCK_BASE, SCROLL_STAMP_PHASE, SCROLL_EDGE_FLAG, SCROLL_STAMP_ROWCOUNT, SCROLL_STAMP_TABLE_80_208, SCROLL_STAMP_TABLE_128_176, SCROLL_STAMP_TABLE_160, TILEMAP_FILL_BASE_22X32 } from "./names.js";

const ROW_PITCH = 32;
const PAIR = 2;
const COLUMN_PAIRS = 2;
const ROWS_PER_STAMP = 2;

export function stampScrollRevealColumn(m) {
  const { mem8 } = m;
  const rowField = mem8[SCROLL_OBJECT_BLOCK_BASE];
  const colField = mem8[(SCROLL_OBJECT_BLOCK_BASE + 1)];
  const rowCount = mem8[(SCROLL_OBJECT_BLOCK_BASE + 2)];

  const step = rowField + ((ROW_PITCH * colField) & 0xff);
  const spans = rowCount === 0 ? 255 : rowCount === 1 ? 256 : rowCount - 1;
  const base = step * spans + TILEMAP_FILL_BASE_22X32;

  const phase = mem8[SCROLL_STAMP_PHASE];
  if (phase === 80 || phase === 208) {
    stamp(base, SCROLL_STAMP_TABLE_80_208);
  } else if (phase === 128 || phase === 176) {
    stamp(base, SCROLL_STAMP_TABLE_128_176);
    if (mem8[SCROLL_EDGE_FLAG] !== 0) mem8[SCROLL_EDGE_FLAG] = 0;
  } else if (phase === 160) {
    stamp(base, SCROLL_STAMP_TABLE_160);
    mem8[SCROLL_EDGE_FLAG] = 1;
  }
  mem8[SCROLL_STAMP_ROWCOUNT] = rowCount - 1;

  function stamp(start, table) {
    let hl = start;
    for (let cp = 0; cp < COLUMN_PAIRS; cp++) {
      let de = table;
      for (let row = 0; row < ROWS_PER_STAMP; row++) {
        mem8[hl] = mem8[de];
        mem8[(hl + 1)] = mem8[(de + 1)];
        hl = hl + ROW_PITCH;
        de = de + PAIR;
      }
    }
  }
}
