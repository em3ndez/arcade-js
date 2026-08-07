// SPDX-License-Identifier: GPL-3.0-only
/** drawCaptionInPenColour — paint the caption a caller's index selects. A table of pointers turns
 * the index into a record; the record opens with the character cell the caption starts at and one
 * more byte, and the glyphs follow. That third byte is STEPPED OVER, not used: the colour every
 * cell gets is the low half of the current colour cell instead, so a caption's own record cannot
 * choose its colour.
 * LIVE-OUT: the cells painted, plus the cursor and the run pointer the painter leaves standing. */

import { u16 } from "../../../core/int.js";
import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";

const RECORD_TABLE = 0x0c50;
const COLOUR = 0xad0c;
const COLOUR_FIELD = 0x0f;
const GLYPHS_START = 3;

export function drawCaptionInPenColour(m) {
  const { regs, mem8 } = m;
  regs.hl = RECORD_TABLE;
  fetchWideTableWord(m);
  const record = regs.de;
  regs.de = m.mem16[record];
  regs.hl = u16(record + GLYPHS_START);
  regs.c = mem8[COLOUR] & COLOUR_FIELD;
  drawTextRun(m);
}
