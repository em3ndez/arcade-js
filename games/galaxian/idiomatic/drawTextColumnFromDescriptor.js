// SPDX-License-Identifier: GPL-3.0-only
//
// drawTextColumnFromDescriptor -- unpack a five-byte text descriptor and paint its column.
//
// WHAT IT IS
//   The middle layer of the static-text kit. At the record pointer it reads a five-byte descriptor --
//   a little-endian source word, a little-endian destination word, and a one-byte character count -- then
//   calls drawTextColumn to paint that many characters up a tilemap column, mapping each source byte to a
//   font tile. The upward walk is fixed here by passing a stride of -32 (one tilemap row up per character).
//
// ROLE IN THE MACHINE
//   Sits between drawTextColumnByIndex (ROM 0x1ccf), which selects which descriptor, and drawTextColumn
//   (ROM 0x1ceb), the inner painter. The descriptors live in TEXT_DESCRIPTOR_TABLE (0x1cf6); this routine
//   is the code that knows their layout.
//
//   ROM 0x1cdc.  Grounding: [seen].
//
// LIVE-OUT: `count` tile codes painted up the column at the descriptor's destination (via drawTextColumn).
import { drawTextColumn } from "./drawTextColumn.js";

// Adding this to a VRAM cell address moves one tilemap row up per character, which is how the descriptor
// path draws each column bottom-to-top; drawTextColumn masks writes to 16 bits so the wrap does the walk.
const COLUMN_UP_STRIDE = 65504; // -32 as an unsigned 16-bit step: one tilemap row up per character

export function drawTextColumnFromDescriptor(m, record = m.regs.hl) {
  const { mem8 } = m;

  // Bytes 0..1: little-endian source text pointer (low byte first).
  const source = mem8[record] | (mem8[record + 1] << 8);
  // Bytes 2..3: little-endian destination VRAM cell (bottom of the column).
  const dest = mem8[record + 2] | (mem8[record + 3] << 8);
  // Byte 4: how many characters to paint.
  const count = mem8[record + 4];

  // Paint the run upward from `dest`, one row (-32) per character.
  drawTextColumn(m, count, source, dest, COLUMN_UP_STRIDE);
}
