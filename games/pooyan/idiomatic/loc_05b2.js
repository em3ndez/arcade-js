// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { FIELD_RECORD_PTR_TABLE } from "./names.js";
/**
 * loc_05b2 — draw a table-selected field of stacked characters bottom-up into video RAM.
 *
 * The selector's low seven bits (doubled) index a pointer table whose entry heads a list of records;
 * each record is a two-byte destination address followed by an inline string. Characters are written
 * one tilemap row up per cell (dest -= 0x20). Bit 7 of the selector picks the mode: clear writes each
 * character as a digit tile (char - '0'), set writes the blank tile for every character. A '.' ends a
 * record and advances to the next; a '?' ends the whole run. Reads the table and strings, writes tiles.
 *
 * LIVE-OUT: memory only — the drawn field. Callers save/restore or reload their registers around this,
 * so no register survives.
 */

const MODE_BLANK_BIT = 0x80; // selector bit 7: blank-fill vs digit-fill
const INDEX_MASK = 0x7f; //    the doubled selector is masked to a 7-bit table index
const BLANK_TILE = 0x10;
const ROW_UP = -0x20; // each character sits one tilemap row above the last (u16-wrapped on add)
const END_RECORD = 0x2e; //    '.' ends this record
const END_RUN = 0x3f; //       '?' ends the whole field
const DIGIT_BASE = 0x30; //    '0': a digit char maps to its tile by subtracting this

export function loc_05b2(m, selector = m.regs.a) {
  const { mem8 } = m;
  const blankMode = (selector & MODE_BLANK_BIT) !== 0;
  const index = (selector << 1) & INDEX_MASK;

  const head = u16(FIELD_RECORD_PTR_TABLE + index);
  let list = mem8[head] | (mem8[u16(head + 1)] << 8);

  for (;;) {
    const dest = mem8[list] | (mem8[u16(list + 1)] << 8);
    let src = u16(list + 2);
    let cell = dest;

    for (;;) {
      const ch = mem8[src];
      if (ch === END_RECORD) break;
      if (ch === END_RUN) return;
      mem8[cell] = blankMode ? BLANK_TILE : u8(ch - DIGIT_BASE);
      src = u16(src + 1);
      cell = u16(cell + ROW_UP);
    }

    list = u16(src + 1); // step past the '.' to the next record's destination address
  }
}
