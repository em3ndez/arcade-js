// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ROPE_CELL_COLUMN_TABLE } from "./names.js";
/**
 * computeRopeCellVramColumn — compute the video-RAM column base for a rope cell.
 *
 * WHAT IT IS
 *   A tiny address-forming helper (ROM 0x2e52-0x2e5d, grounding [seen]) shared by the rope-cell
 *   state handlers. The rope that hangs down through the playfield is drawn as a small set of
 *   fixed vertical columns of tiles; this routine answers one question — "given a rope cell,
 *   where in video RAM does its column start?" — and hands back the pointer.
 *
 * ITS ROLE IN THE MACHINE
 *   The rope subsystem keeps one record per active rope cell. The low two bits of that record pick
 *   which of four rope columns the cell belongs to (the very same two bits that also select the
 *   cell's stride-2 frame timer, so the timer and the on-screen column stay in lockstep). The cell
 *   handlers seat the cell record in the IX index register, so its low byte (IXL) carries those two
 *   bits in here. Every rope handler that needs to paint — grow a segment, carry a hung object down,
 *   retract — first calls this to turn the cell's column index into a concrete drawing pointer, then
 *   blits a 2x2 tile block at the returned address.
 *
 *   The picture the player sees lives in two parallel planes over one 32x32 cell grid: colour RAM
 *   at 0x8000-0x83FF (one attribute byte per cell) and video RAM at 0x8400-0x87FF (one tile-code
 *   byte per cell). This routine works entirely in the video-RAM (tile-code) plane, page 0x84.
 *
 * HOW THE ADDRESS IS FORMED
 *   Low two bits of IXL -> a 4-entry ROM table (ROPE_CELL_COLUMN_TABLE, ROM 0x2db8) that maps a
 *   rope-cell index to that column's *low* address byte inside video RAM. That low byte is then
 *   paired with the fixed high byte 0x84 (the video-RAM tilemap page) to make the full 16-bit
 *   pointer to the top cell of the chosen column.
 *
 * LIVE-OUT: HL = the column base (a video-RAM pointer the rope-cell handlers draw through); the
 * fetched low-byte is also left in A (it equals HL's low half). Both bridged for the caller.
 */
const VIDEO_RAM_PAGE = 0x84; // high byte of the tilemap page the column lives in (video RAM 0x8400-0x87FF)

export function computeRopeCellVramColumn(m, ixl = m.regs.ix & 0xff) {
  // Step 1 — pick the column's low address byte from the rope-cell table.
  //   Mask IXL down to its low two bits: that is the rope cell's column index (0..3), the same two
  //   bits the cell record uses to select its frame timer. Index the 4-entry ROM table at
  //   ROPE_CELL_COLUMN_TABLE (ROM 0x2db8), which maps each rope-cell index to the low byte of its
  //   video-RAM column. fetchByteFromTableIndex forms base+index and reads the byte living there,
  //   returning that byte (also parked in A) and the table pointer it read from.
  const [columnLow] = fetchByteFromTableIndex(m, ROPE_CELL_COLUMN_TABLE, ixl & 0x03); // A := table byte, HL := table ptr
  // Step 2 — glue the fixed video-RAM page onto that low byte to form the column base.
  //   High byte 0x84 (the video-RAM tilemap page) shifted up and OR-ed with the fetched low byte
  //   yields the 16-bit pointer 0x84xx to the top cell of the chosen rope column. Leave it in HL:
  //   this is the address every rope-cell blit draws its 2x2 tile block through.
  return (m.regs.hl = u16((VIDEO_RAM_PAGE << 8) | columnLow)); // HL live-out: the column base
}
