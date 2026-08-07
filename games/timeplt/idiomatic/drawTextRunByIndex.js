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

const CAPTION_TABLE = 0x0c50;
const HEADER_BYTES = 3;

export function drawTextRunByIndex(m, caption = m.regs.a) {
  const { regs, mem8 } = m;
  regs.a = caption;
  regs.hl = CAPTION_TABLE;
  fetchWideTableWord(m);

  const record = regs.de;
  regs.de = mem8[record] | (mem8[u16(record + 1)] << 8);
  regs.c = mem8[u16(record + 2)];
  regs.hl = u16(record + HEADER_BYTES);
  drawTextRun(m);
}
