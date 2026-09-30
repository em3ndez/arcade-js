// SPDX-License-Identifier: GPL-3.0-only
/** drawTextRunByIndex — paint the caption an index selects. The index picks a record out of one fixed table
 * of pointers; the record opens with the cell the caption starts at and the colour every cell of
 * it takes, and the glyph run follows those three bytes. Nothing here decides what the caption
 * says or where it lands: the index does, and this entry only unpacks the header and hands the
 * three pieces to the painting.
 *
 * ROM 0x0BF2-0x0BFE, falling straight through into drawTextRun at 0x0BFF.
 * Grounding: [seen] (names.js ROUTINES 0x0BF2).
 *
 * ROLE IN THE MACHINE. This is command 1's handler in the command ring ("caption in its own
 * colour", mechanisms.md §8): the attract screens post their whole layout as bursts of command-1
 * captions, and the foreground drain loop dispatches each here through the handler table at
 * 0x0BBC. It is the one member of the caption family that uses the colour byte the record itself
 * carries; its three siblings step over that byte and colour from PEN_COLOUR instead. names.js
 * records that the table holds 32 records (indices 0-31, the largest ever presented under MAME).
 * PARAMETER: caption = the caption number, the ring command's argument (the ROM's A).
 * LIVE-OUT: the painted cells, plus the cursor left standing where
 * the painting stopped. */

import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { u16 } from "../../../core/int.js";
import { CAPTION_RECORD_TABLE } from "./names.js";

// Record header: start-cell word (2 bytes, little-endian, in the video plane) + colour byte (1).
const HEADER_BYTES = 3;

export function drawTextRunByIndex(m, caption = m.regs.a) {
  const { mem8 } = m;
  // Index -> record through CAPTION_RECORD_TABLE 0x0C50 (ROM `ld hl,0x0c50 / call 0x018c`).
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, caption);
  // Unpack the header byte by byte, as the ROM does (`ld e,(hl) / inc hl / ld d,(hl) / inc hl /
  // ld c,(hl)`): start cell, then the record's own colour.
  const cursor = mem8[record] | (mem8[u16(record + 1)] << 8);
  const colour = mem8[u16(record + 2)];
  // The glyph run (ended by 0xB9) follows the header.
  const run = u16(record + HEADER_BYTES);
  // Hand the three pieces to the painter; drawTextRun's cursor is this routine's result.
  return drawTextRun(m, run, cursor, colour);
}
