// SPDX-License-Identifier: GPL-3.0-only
/** drawCaptionFivePastSharedColour — draw the caption a caller's index picks out, in a colour the caption does not own.
 *
 * ROM 0x3421-0x3437. Grounding: [seen] (names.js ROUTINES 0x3421).
 *
 * ROLE IN THE MACHINE. This is command 10's handler in the command ring: a sequence arm posts
 * (10, caption index) into COMMAND_RING, and the foreground drain loop dispatches it here through
 * the sixteen-word handler table at 0x0BBC (mechanisms.md §8, "The command ring"). It is the +5
 * member of a family of caption painters that all walk the same record table: drawTextRunByIndex
 * uses the record's own colour, drawCaptionInPenColour the pen colour +0, this one +5, and
 * drawCaptionTenPastSharedColour +10. Taking turns at one caption, the three pen-based members are
 * what makes it flash (names.js, drawCaptionTenPastSharedColour).
 *
 * The index selects a record from a fixed table of them; the record's first two bytes give the
 * cell to start at, its third byte is a colour and is STEPPED OVER unread, and the glyphs run on
 * from there. The colour used instead is derived from the pen colour cell (PEN_COLOUR 0xAD0C
 * [seen]), shifted along by a fixed amount and cut to four bits, so the caption's colour follows
 * that cell (the era's pen colour) while the colour sitting in the record never shows.
 * PARAMETER: index = the caption number, the ring command's argument (the ROM's A).
 * LIVE-OUT: the cells painted, and the cursors; the colour used is also returned (left in C). */

import { drawTextRun } from "./drawTextRun.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { u16 } from "../../../core/int.js";
import { PEN_COLOUR, CAPTION_RECORD_TABLE } from "./names.js";

// Caption record layout (mechanisms.md §8, "Caption records"): a start-cell word in the video
// plane, one colour byte, then the glyph run ended by 0xB9.
const DESTINATION_BYTES = 2;
const STORED_COLOUR_BYTES = 1;
// The +5 offset and four-bit mask: ROM `add a,0x05 / and 0x0f` at 0x3430-0x3432. Masking to the low
// nibble also clears bit 4, so the caption always sits in the under-sprite category.
const COLOUR_PHASE = 5;
const COLOUR_MASK = 0x0f;

export function drawCaptionFivePastSharedColour(m, index = m.regs.a) {
  const { mem8, mem16 } = m;
  // Look the caption's record up in CAPTION_RECORD_TABLE 0x0C50 (ROM `ld hl,0x0c50 / call 0x018c`).
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, index);
  // Colour from outside the record: pen colour + 5, kept to four bits (ROM 0x342D-0x3434).
  const colour = (mem8[PEN_COLOUR] + COLOUR_PHASE) & COLOUR_MASK;
  // Paint: the glyph run starts past the destination word AND the unused colour byte (the ROM's
  // third `inc hl` at 0x342C steps over it); the start cell is the record's first word. The ROM
  // reaches drawTextRun (0x0BFF) by a tail jump, so this routine ends where the painting ends.
  drawTextRun(m, u16(record + DESTINATION_BYTES + STORED_COLOUR_BYTES), mem16[record], colour);
  return (m.regs.c = colour);
}
