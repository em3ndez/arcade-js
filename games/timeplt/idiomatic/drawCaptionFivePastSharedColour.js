// SPDX-License-Identifier: GPL-3.0-only
/** drawCaptionFivePastSharedColour — draw the caption a caller's index picks out, in a colour the caption does not own.
 *
 * The index selects a record from a fixed table of them; the record's first two bytes give the
 * cell to start at, its third byte is a colour and is STEPPED OVER unread, and the glyphs run on
 * from there. The colour used instead is derived from a counter cell, shifted along by a fixed
 * amount and cut to four bits, so the caption changes colour as that counter turns over while
 * the colour sitting in the record never shows. LIVE-OUT: the cells painted, and the cursors. */

import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { u16 } from "../../../core/int.js";
import { PEN_COLOUR, CAPTION_RECORD_TABLE } from "./names.js";

const DESTINATION_BYTES = 2;
const STORED_COLOUR_BYTES = 1;
const COLOUR_PHASE = 5;
const COLOUR_MASK = 0x0f;

export function drawCaptionFivePastSharedColour(m) {
  const { mem8, mem16, regs } = m;
  regs.hl = CAPTION_RECORD_TABLE;
  fetchWideTableWord(m);
  const record = regs.de;

  regs.de = mem16[record];
  regs.hl = u16(record + DESTINATION_BYTES + STORED_COLOUR_BYTES);
  regs.c = (mem8[PEN_COLOUR] + COLOUR_PHASE) & COLOUR_MASK;
  drawTextRun(m);
}
