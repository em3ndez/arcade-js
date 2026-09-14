// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { TABLE_CURSOR, loc_39, DRAW_CURSOR_LO, SLOT_VALUE, CHAR_GLYPH_TABLE } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * drawThreeCharGlyphString — render a three-character glyph string into the display list. ROM 0xaef8.
 *
 * Role in the machine: Tempest draws text (scores, "PLAYER ONE", level numbers, rack labels)
 * as vector-generator character strokes rather than a tile font. Each character code indexes a
 * table of pre-built two-byte glyph words. This routine copies the glyph words for three
 * consecutive characters from a text buffer into the current display-list cursor, so a
 * fixed-width three-character field lands on screen in one call.
 *
 * Behaviour: point TABLE_CURSOR at the last of the three source codes (a+2) and seed the
 * count loc_39 at 2 (three passes: 2,1,0 before it rolls to 0xff). Cache the display cursor
 * pointer DRAW_CURSOR_LO ($74) in p and start the write offset y at 0. Each pass reads the
 * character code SLOT_VALUE+TABLE_CURSOR, clamps codes >= 0x1e down to 0x1a (blank/space
 * fold), doubles it to a word index into CHAR_GLYPH_TABLE, and copies that glyph's two bytes
 * to p+y (advancing y by two). Then step TABLE_CURSOR back one code and decrement loc_39,
 * looping while it stays non-negative (< 0x80). After the three characters, back y up by one
 * and hand off to advanceDisplayCursor to move the cursor past everything written.
 *
 * Live-out: the three glyph words written at ($74), and the display cursor DRAW_CURSOR_LO
 * advanced past them (by advanceDisplayCursor). TABLE_CURSOR/loc_39 left at their terminal values.
 *
 * Grounding: [seen].
 */
export function drawThreeCharGlyphString(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[TABLE_CURSOR] = u8(a + 2);        // start at the last of the three source codes
  mem8[loc_39] = 0x02;                   // three passes: 2, 1, 0
  const p = mem16[DRAW_CURSOR_LO];       // current display-list cursor
  let y = 0x00;                          // write offset into the cursor
  while (true) {
    const cell = mem8[u16(SLOT_VALUE + mem8[TABLE_CURSOR])];
    const idx = u8((cell >= 0x1e ? 0x1a : cell) << 1); // clamp then double to a word index
    mem8[u16(p + y)] = mem8[u16(CHAR_GLYPH_TABLE + idx)];      // glyph word low byte
    y = u8(y + 1);
    mem8[u16(p + y)] = mem8[u16(CHAR_GLYPH_TABLE + idx + 1)];  // glyph word high byte
    y = u8(y + 1);
    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);  // walk back one source code
    mem8[loc_39] = u8(mem8[loc_39] - 1);
    if (mem8[loc_39] < 0x80) continue; // loop while non-negative
    break;
  }
  y = u8(y - 1);                         // last-written offset for the cursor advance
  return advanceDisplayCursor(m, y);
}
