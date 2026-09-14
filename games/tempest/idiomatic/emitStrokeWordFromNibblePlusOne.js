// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, NIBBLE_GLYPH_TABLE } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * emitStrokeWordFromNibblePlusOne / emitStrokeWordByIndex -- emit one stroke/glyph vector
 * word from the vector-ROM stroke table. ROM 0xdf1f (nibble front) / 0xdf24 (index entry).
 *
 * Role in the machine: this is the sibling of emitStrokeWordFromNibble and shares the same
 * copy-and-advance tail, but without the carry-terminator special case. It is the glyph-word
 * emitter used when the caller already knows it wants nibble+1 (no zero-terminator), or wants
 * to emit an entry by an explicit table index. Every character the vector display draws --
 * score digits, level text, markers -- ultimately flows one word at a time through this tail
 * into the display list.
 *
 * Behaviour (front, emitStrokeWordFromNibblePlusOne): take A's low nibble and form the index
 * (nibble & 0x0f) + 1, then delegate to the by-index tail. Behaviour (tail,
 * emitStrokeWordByIndex): double the index (<<1, entries are 16-bit words) to address
 * NIBBLE_GLYPH_TABLE (loc_31e4), read the display cursor pointer (DRAW_CURSOR_LO, loc_74),
 * copy the entry's two bytes into (loc_74)+0 and +1, and advance the cursor two bytes via
 * advanceDisplayCursor. On the real board the front is wrapped in a flag save/restore, so the
 * preserved return value in A is the advanced-cursor low byte the emit leaves, not the flags.
 *
 * Live-out: two bytes appended to the display list at (loc_74); the cursor loc_74/loc_75
 * advanced two; return value is the new cursor low byte. Grounding: [seen].
 */
// Turn the low nibble into a word-table index (nibble+1), then emit that entry.
// Exit A (live-out) is the advanced cursor low byte left by the emit (the flag
// save/restore around it preserves flags, not A).
export function emitStrokeWordFromNibblePlusOne(m, a = m.regs.a) {
  return emitStrokeWordByIndex(m, (a & 0x0f) + 1); // map low nibble -> index nibble+1
}

// Copy the indexed word-table entry's two bytes into the ($74) list, then step the
// cursor past them.
export function emitStrokeWordByIndex(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  const src = u16(NIBBLE_GLYPH_TABLE + (a << 1)); // <<1: stroke entries are 16-bit words
  const dst = mem16[DRAW_CURSOR_LO];          // loc_74: display-list write pointer
  mem8[u16(dst)] = mem8[src];                 // copy the glyph's two stroke bytes
  mem8[u16(dst + 1)] = mem8[u16(src + 1)];
  return advanceDisplayCursor(m, 1);          // advance two bytes, return new cursor low
}
