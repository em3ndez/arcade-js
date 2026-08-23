// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { ROPE_CELL_COLUMN_TABLE } from "./names.js";
/**
 * computeRopeCellVramColumn — compute the video-RAM column base for a rope cell.
 *
 * The low two bits of IXL index a small table of column low-bytes; the fetched byte becomes the low
 * half of a tilemap address whose high half is the fixed video-RAM page. Returns that pointer.
 *
 * LIVE-OUT: HL = the column base (a video-RAM pointer the rope-cell handlers draw through); the
 * fetched low-byte is also left in A (it equals HL's low half). Both bridged for the caller.
 */
const VIDEO_RAM_PAGE = 0x84; // high byte of the tilemap page the column lives in

export function computeRopeCellVramColumn(m, ixl = m.regs.ix & 0xff) {
  const [columnLow] = loc_0020(m, ROPE_CELL_COLUMN_TABLE, ixl & 0x03); // A := table byte, HL := table ptr
  return (m.regs.hl = u16((VIDEO_RAM_PAGE << 8) | columnLow)); // HL live-out: the column base
}
