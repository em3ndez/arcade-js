// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCaptionTenPastSharedColour — paint the caption a caller's index selects, in a colour that follows a cell this
 * routine does not own. The index picks a record out of one fixed table; the record's first two
 * bytes say where the caption goes and its glyphs begin three bytes in, so the byte between them
 * is stepped over unread. The colour is that cell's value plus ten kept to four bits — an offset
 * from a colour chosen elsewhere, not a colour chosen here — and every cell of the caption gets it.
 * LIVE-OUT: memory, plus the colour, the cursor and the run pointer the painting leaves behind.
 */

import { u8, u16 } from "../../../core/int.js";
import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { PEN_COLOUR, CAPTION_RECORD_TABLE } from "./names.js";

const GLYPHS_FROM = 3;
const COLOUR_BIAS = 10;
const COLOUR_MASK = 0x0f;

export function drawCaptionTenPastSharedColour(m) {
  const { regs, mem8, mem16 } = m;
  regs.hl = CAPTION_RECORD_TABLE;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = mem16[record];
  regs.hl = u16(record + GLYPHS_FROM);
  regs.c = u8(mem8[PEN_COLOUR] + COLOUR_BIAS) & COLOUR_MASK;
  return drawTextRun(m);
}
