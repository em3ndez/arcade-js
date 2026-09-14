// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, NIBBLE_GLYPH_TABLE } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * emitStrokeWordFromNibble -- emit one stroke/glyph vector word chosen by A's low nibble.
 * ROM 0xdf19.
 *
 * Role in the machine: Tempest draws every digit, letter and marker as a stroke word looked
 * up in the vector-ROM stroke table (NIBBLE_GLYPH_TABLE, loc_31e4 -- one 16-bit entry per
 * glyph). This is the leaf that text/number builders call once per character: it maps the
 * low nibble of A to a table index, copies that glyph's two bytes into the growing display
 * list, and advances the write cursor. The digit-run emitters (emitNibbleDigitRun and
 * friends) feed nibbles here one at a time, using the carry flag as the run terminator.
 *
 * Behaviour: keep the low nibble of A. The index is 0 only when the caller passes carry set
 * AND the nibble is zero (the terminator case, selecting glyph entry 0); otherwise it is
 * nibble+1. The index is doubled (<<1) because each stroke entry is a 16-bit word, giving
 * the byte address loc_31e4 + index*2. Read the display cursor pointer (DRAW_CURSOR_LO,
 * loc_74) and copy the two stroke bytes to (loc_74)+0 and +1, then call advanceDisplayCursor
 * to step the 16-bit cursor two bytes forward (Y=1 -> advance Y+1).
 *
 * Live-out: two bytes appended to the display list at (loc_74); the cursor loc_74/loc_75
 * advanced by two. Grounding: [seen].
 */
// Pick a word-table index from the low nibble (0 when carry-set and the nibble is
// zero, else nibble+1), copy that entry's two bytes into the ($74) list, then step
// the cursor past them.
export function emitStrokeWordFromNibble(m, a = m.regs.a, c = m.regs.fC) {
  const { mem8, mem16 } = m;
  const low = a & 0x0f;                       // glyph selector is the low nibble of A
  const idx = c && low === 0 ? 0 : low + 1;   // carry+zero -> terminator glyph 0, else nibble+1
  const src = u16(NIBBLE_GLYPH_TABLE + (idx << 1)); // <<1: entries are 16-bit words
  const dst = mem16[DRAW_CURSOR_LO];          // loc_74: display-list write pointer
  mem8[u16(dst)] = mem8[src];                 // copy the glyph's two stroke bytes
  mem8[u16(dst + 1)] = mem8[u16(src + 1)];
  advanceDisplayCursor(m, 1);                 // step the cursor two bytes past the word
}
