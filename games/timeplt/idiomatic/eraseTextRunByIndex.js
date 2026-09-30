// SPDX-License-Identifier: GPL-3.0-only
/** eraseTextRunByIndex — blank out the caption one record describes. The record is picked by number out of a
 * table of record addresses; its first two bytes name the cell to start from and the byte after
 * them is stepped over unread. Each byte of the run that follows is read only to test it against
 * the code that ends the run — the byte WRITTEN is always the same blank, so what the caption said
 * makes no difference to what replaces it — and the cursor steps one cell along the line after
 * every one. A run that is empty writes nothing. Only one plane is written; the cell's colour is
 * left standing, so a blanked caption keeps whatever tint it had. LIVE-OUT: memory only.
 *
 * ROM 0x0C39-0x0C4F (frozen lift loc_0c39). Grounding: [seen] (names.js ROUTINES 0x0C39).
 *
 * Role in the machine: this is command 3 of the command ring — the ring's handler table at 0x0BBC
 * seats it at slot 3, while drawTextRunByIndex sits at slot 1 — so it is the draw handler's
 * inverse: the same caption record, the same cells, blanked. Screens post (3, caption number) to
 * take a caption down, e.g. holdCopyrightThenEraseTheCoinInvitation erasing the coin invitation
 * (mechanisms.md, command ring). Under MAME a video-RAM cell took the blank from this routine's
 * store in a driven game and a glyph from the draw routine in attract, and no colour-plane write
 * was ever attributed to it (names.js).
 *
 * Caption records (CAPTION_RECORD_TABLE 0x0C50, a table of record addresses indexed by caption
 * number): each record is { start-cell word, colour byte, glyph run ending in 0xB9 }. The colour
 * byte is what the draw handlers use; the eraser skips it.
 *
 * Because the run's length is taken from the record and its contents are ignored, erasing one
 * record blanks exactly as many cells as that caption has glyphs, starting at its cell.
 *
 * Parameter: `recordNumber` — the caption number (A in the ROM; the ring's argument byte).
 */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { CAPTION_RECORD_TABLE } from "./names.js";

const RUN_STARTS_AT = 3; // two-byte start cell + one colour byte, then the glyph run
const END_OF_TEXT = 185; // 0xB9: cp 0xb9 / ret z — the run terminator
const BLANK = 241; // 0xF1: the blank glyph

export function eraseTextRunByIndex(m, recordNumber = m.regs.a) {
  const { mem8 } = m;
  /* Find the record: ld hl,0x0c50 / call 0x018c (fetchWideTableWord) returns the address stored
   * in entry `recordNumber` of the caption table. */
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, recordNumber);
  /* The record's first word is the video-RAM cell the caption starts at (ld e,(hl) / ld d,(hl)).
   * The ROM then steps HL three bytes on, over the colour byte, to the first glyph. */
  let cursor = m.mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  /* Walk the run until the 0xB9 terminator. Each glyph position gets the blank written into the
   * character plane (ld a,0xf1 / ld (de),a); the colour RAM is not touched. The cursor then moves
   * one cell along the line with rst 0x20 (advanceCharCursor, 32 bytes back in video RAM, one
   * cell on the rotated screen). */
  while (mem8[next] !== END_OF_TEXT) {
    mem8[cursor] = BLANK;
    next = u16(next + 1);
    cursor = advanceCharCursor(m, cursor);
  }
}
