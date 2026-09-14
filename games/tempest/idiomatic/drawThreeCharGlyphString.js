// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { TABLE_CURSOR, loc_39, DRAW_CURSOR_LO, SLOT_VALUE, CHAR_GLYPH_TABLE } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

// Copy three 2-byte glyph words into the pointer buffer: each source byte (capped at 0x1a) indexes a
// word table; after the copies, advance the buffer cursor past what was written.
export function drawThreeCharGlyphString(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[TABLE_CURSOR] = u8(a + 2);
  mem8[loc_39] = 0x02;
  const p = mem16[DRAW_CURSOR_LO];
  let y = 0x00;
  while (true) {
    const cell = mem8[u16(SLOT_VALUE + mem8[TABLE_CURSOR])];
    const idx = u8((cell >= 0x1e ? 0x1a : cell) << 1);
    mem8[u16(p + y)] = mem8[u16(CHAR_GLYPH_TABLE + idx)];
    y = u8(y + 1);
    mem8[u16(p + y)] = mem8[u16(CHAR_GLYPH_TABLE + idx + 1)];
    y = u8(y + 1);
    mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);
    mem8[loc_39] = u8(mem8[loc_39] - 1);
    if (mem8[loc_39] < 0x80) continue; // loop while non-negative
    break;
  }
  y = u8(y - 1);
  return advanceDisplayCursor(m, y);
}
