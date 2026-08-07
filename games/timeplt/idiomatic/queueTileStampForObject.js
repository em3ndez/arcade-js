// SPDX-License-Identifier: GPL-3.0-only
/** queueTileStampForObject — queue a two-by-two block of tiles for the object's position onto the deferred
 * character-write list.
 *
 * Two of the object's bytes are read as pixel coordinates and biased by seven. The high five
 * bits of each give the cell the block starts at — thirty-two cells to a row, from one fixed
 * plane base. The low three bits of each select one of sixty-four pre-shifted records, and each
 * record holds four glyph-and-attribute pairs, one per cell of the block. A pair whose glyph is
 * zero is skipped, so a block can be partly transparent; the rest are appended to the list as
 * four bytes each — the cell address low half first, then its high half, then the glyph, then
 * the attribute. The list's own write pointer is stepped a byte at a time WITHOUT leaving its
 * page, so a full list wraps onto its own head rather than running on. The cell walks across,
 * down a row, and across again between the four pairs, and that walk happens whether or not the
 * pair was skipped.
 * LIVE-OUT: memory only — the list and its write pointer. */

import { u16, u8 } from "../../../core/int.js";
import { DEFERRED_WRITE_CURSOR } from "./names.js";

const FIRST_AXIS = 4;
const SECOND_AXIS = 6;
const PIXEL_BIAS = 7;
const CELLS_PER_ROW = 32;
const PLANE_BASE = 0xa000;
const RECORDS = 0x53d4;
const RECORD_BYTES = 8;
const SUB_CELLS = 8;
const SUB_CELL_BITS = SUB_CELLS - 1;

/** Where the cell walks between one pair and the next: across, down a row, across, then done. */
const CELL_WALK = [1, CELLS_PER_ROW - 1, 1, 0];

export function queueTileStampForObject(m, object = m.regs.ix) {
  const { mem8 } = m;
  const first = u8(mem8[object + FIRST_AXIS] + PIXEL_BIAS);
  const second = u8(mem8[object + SECOND_AXIS] + PIXEL_BIAS);

  let cell = PLANE_BASE + (first >> 3) * CELLS_PER_ROW + (second >> 3);
  const subCell = (first & SUB_CELL_BITS) * SUB_CELLS + (second & SUB_CELL_BITS);
  let record = RECORDS + subCell * RECORD_BYTES;

  for (const step of CELL_WALK) {
    const glyph = mem8[record];
    const attribute = mem8[record + 1];
    record += 2;
    if (glyph !== 0) appendCell(m, cell, glyph, attribute);
    cell = u16(cell + step);
  }
}

/** Four bytes onto the tail of the list; the write pointer stays inside its own page. */
function appendCell(m, cell, glyph, attribute) {
  const { mem8, mem16 } = m;
  let out = mem16[DEFERRED_WRITE_CURSOR];
  for (const byte of [cell & 0xff, cell >> 8, glyph, attribute]) {
    mem8[out] = byte;
    out = (out & 0xff00) | u8(out + 1);
  }
  mem16[DEFERRED_WRITE_CURSOR] = out;
}
