// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20fb — stamp a scroll-reveal column into VRAM for the scroll object.
 *
 * Builds a VRAM address from the object's row, column and row-count fields, then picks a
 * stamp table by the scroll-phase byte: two phases share one table, two share another and
 * clear an edge flag, one uses a third and sets that flag; any other phase stamps nothing.
 * Every path finishes by writing the object's row-count-minus-one mirror.
 * LIVE-OUT: memory-only.
 */
import { loc_8273, loc_8110, loc_8107, loc_811a, loc_2190, loc_2194, loc_2198, loc_a808 } from "./names.js";

const ROW_PITCH = 32;
const PAIR = 2;
const COLUMN_PAIRS = 2;
const ROWS_PER_STAMP = 2;

export function loc_20fb(m) {
  const { mem8 } = m;
  const rowField = mem8[loc_8273];
  const colField = mem8[(loc_8273 + 1) & 0xffff];
  const rowCount = mem8[(loc_8273 + 2) & 0xffff];

  const step = rowField + ((ROW_PITCH * colField) & 0xff);
  const spans = rowCount === 0 ? 255 : rowCount === 1 ? 256 : rowCount - 1;
  const base = (step * spans + loc_a808) & 0xffff;

  const phase = mem8[loc_8110];
  if (phase === 80 || phase === 208) {
    stamp(base, loc_2190);
  } else if (phase === 128 || phase === 176) {
    stamp(base, loc_2194);
    if (mem8[loc_8107] !== 0) mem8[loc_8107] = 0;
  } else if (phase === 160) {
    stamp(base, loc_2198);
    mem8[loc_8107] = 1;
  }
  mem8[loc_811a] = (rowCount - 1) & 0xff;

  function stamp(start, table) {
    let hl = start;
    for (let cp = 0; cp < COLUMN_PAIRS; cp++) {
      let de = table;
      for (let row = 0; row < ROWS_PER_STAMP; row++) {
        mem8[hl] = mem8[de];
        mem8[(hl + 1) & 0xffff] = mem8[(de + 1) & 0xffff];
        hl = (hl + ROW_PITCH) & 0xffff;
        de = (de + PAIR) & 0xffff;
      }
    }
  }
}
