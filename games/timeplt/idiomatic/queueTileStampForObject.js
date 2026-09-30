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
 * LIVE-OUT: memory only — the list and its write pointer.
 *
 * ROM: 0x5337. Tag [seen] (names.js). Role in the machine: how a player's shot gets on screen. The
 * shots are not hardware sprites; the shot engine (fireAndSweepPlayerShots) draws each one through
 * this routine as a block of character cells. Because a character cell is eight pixels square, the
 * glyphs in the ROM table are pre-drawn at every one of the 8 x 8 sub-cell offsets, which is what
 * lets a shot move smoothly (mechanisms.md). Nothing is drawn here: the entries wait on the list
 * behind DEFERRED_WRITE_CURSOR 0xAE00 [seen] until paintDeferredCells writes them at vertical blank.
 *
 * Parameter: `object` is the shot's record (the ROM's IX); bytes +4 and +6 are its two coordinates. */

import { u16, u8 } from "../../../core/int.js";
import { DEFERRED_WRITE_CURSOR, COLOUR_PLANE_BASE, PRESHIFTED_TILE_RECORD_TABLE } from "./names.js";

const FIRST_AXIS = 4;
const SECOND_AXIS = 6;
const PIXEL_BIAS = 7;
const CELLS_PER_ROW = 32;
const PLANE_BASE = COLOUR_PLANE_BASE;
const RECORDS = PRESHIFTED_TILE_RECORD_TABLE;
const RECORD_BYTES = 8;
const SUB_CELLS = 8;
const SUB_CELL_BITS = SUB_CELLS - 1;

// The block's four cells in list order: top-left, top-right, bottom-left, bottom-right.
/** Where the cell walks between one pair and the next: across, down a row, across, then done. */
const CELL_WALK = [1, CELLS_PER_ROW - 1, 1, 0];

export function queueTileStampForObject(m, object = m.regs.ix) {
  const { mem8 } = m;
  // Both coordinates biased by 7 and wrapped to a byte (ROM: ld a,(ix+4) / add a,0x07 and the same
  // for ix+6). Each biased byte is then split into a whole-cell part and an eighth-of-a-cell part.
  const first = u8(mem8[object + FIRST_AXIS] + PIXEL_BIAS);
  const second = u8(mem8[object + SECOND_AXIS] + PIXEL_BIAS);

  // Whole part: the first coordinate's top five bits pick the row, the second's the column, in a
  // 32-cell-wide plane at COLOUR_PLANE_BASE 0xA000 — the colour plane, whose address the drain
  // later turns into the character-plane address by setting bit 10.
  let cell = PLANE_BASE + (first >> 3) * CELLS_PER_ROW + (second >> 3);
  // Fractional part: the low three bits of each pick one of 64 eight-byte records in the ROM
  // table PRESHIFTED_TILE_RECORD_TABLE 0x53D4.
  const subCell = (first & SUB_CELL_BITS) * SUB_CELLS + (second & SUB_CELL_BITS);
  let record = RECORDS + subCell * RECORD_BYTES;

  // Four glyph/attribute pairs; a zero glyph leaves that cell out (the block is partly empty),
  // but the cell cursor still moves, so the next pair lands in the right place.
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
    out = (out - (out & 0xff)) + u8(out + 1); // step the low half only; the list stays in its page
  }
  mem16[DEFERRED_WRITE_CURSOR] = out;
}
