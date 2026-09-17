// SPDX-License-Identifier: GPL-3.0-only
/** drawTextRunByIndex — paint the caption an index selects. The index picks a record out of one fixed table
 * of pointers; the record opens with the cell the caption starts at and the colour every cell of
 * it takes, and the glyph run follows those three bytes. Nothing here decides what the caption
 * says or where it lands: the index does, and this entry only unpacks the header and hands the
 * three pieces to the painting. LIVE-OUT: the painted cells, plus the cursor and the run pointer
 * left standing where the painting stopped. */

import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { u16 } from "../../../core/int.js";
import { CAPTION_RECORD_TABLE } from "./names.js";

const HEADER_BYTES = 3;

export function drawTextRunByIndex(m, caption = m.regs.a) {
  const { mem8 } = m;
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, caption);
  const cursor = mem8[record] | (mem8[u16(record + 1)] << 8);
  const colour = mem8[u16(record + 2)];
  const run = u16(record + HEADER_BYTES);
  return (m.regs.c = colour, drawTextRun(m, run, cursor, colour));
}
