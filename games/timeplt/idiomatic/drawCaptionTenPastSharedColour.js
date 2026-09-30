// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawCaptionTenPastSharedColour — paint the caption a caller's index selects, in a colour that follows a cell this
 * routine does not own. The index picks a record out of one fixed table; the record's first two
 * bytes say where the caption goes and its glyphs begin three bytes in, so the byte between them
 * is stepped over unread. The colour is that cell's value plus ten kept to four bits — an offset
 * from a colour chosen elsewhere, not a colour chosen here — and every cell of the caption gets it.
 *
 * ROM 0x0C23-0x0C38. Grounding: [seen] (names.js ROUTINES 0x0C23).
 *
 * ROLE IN THE MACHINE. This is command 11's handler in the command ring ("caption, pen colour
 * + 10", mechanisms.md §8): a sequence arm posts (11, caption index) and the foreground drain loop
 * dispatches it here through the handler table at 0x0BBC. The cell is PEN_COLOUR 0xAD0C [seen].
 * It is the +10 member of the caption family (drawCaptionInPenColour +0,
 * drawCaptionFivePastSharedColour +5). This routine's own colour does not cycle -- names.js
 * records that under MAME it painted caption 27 only at source value 2 and caption 28 only at
 * source value 3 -- the flashing comes from the three handlers taking turns at one caption.
 * PARAMETER: index = the caption number, the ring command's argument (the ROM's A).
 * LIVE-OUT: memory, plus the cursor the painting leaves behind (returned).
 */

import { u8, u16 } from "../../../core/int.js";
import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { PEN_COLOUR, CAPTION_RECORD_TABLE } from "./names.js";

// Record layout: start-cell word (2) + colour byte (1); the glyph run begins at +3.
const GLYPHS_FROM = 3;
// The +10 offset and four-bit mask: ROM `add a,0x0a / and 0x0f` at 0x0C32-0x0C34.
const COLOUR_BIAS = 10;
const COLOUR_MASK = 0x0f;

export function drawCaptionTenPastSharedColour(m, index = m.regs.a) {
  const { mem8, mem16 } = m;
  // Index -> record through CAPTION_RECORD_TABLE 0x0C50 (ROM `ld hl,0x0c50 / call 0x018c`).
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, index);
  // Unpack the header: the start cell is the record's first word; the run skips the colour byte
  // too (the ROM's third `inc hl` at 0x0C2E steps over it).
  const cursor = mem16[record];
  const run = u16(record + GLYPHS_FROM);
  // Colour = pen colour + 10, low nibble only (ROM 0x0C2F-0x0C36).
  const colour = u8(mem8[PEN_COLOUR] + COLOUR_BIAS) & COLOUR_MASK;
  // Paint; the ROM tail-jumps into drawTextRun (`jr 0x0bff`), so its cursor is this routine's result.
  return drawTextRun(m, run, cursor, colour);
}
