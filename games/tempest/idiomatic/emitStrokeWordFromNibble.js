// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, NIBBLE_GLYPH_TABLE } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

// Pick a word-table index from the low nibble (0 when carry-set and the nibble is
// zero, else nibble+1), copy that entry's two bytes into the ($74) list, then step
// the cursor past them.
export function emitStrokeWordFromNibble(m, a = m.regs.a, c = m.regs.fC) {
  const { mem8, mem16 } = m;
  const low = a & 0x0f;
  const idx = c && low === 0 ? 0 : low + 1;
  const src = u16(NIBBLE_GLYPH_TABLE + (idx << 1));
  const dst = mem16[DRAW_CURSOR_LO];
  mem8[u16(dst)] = mem8[src];
  mem8[u16(dst + 1)] = mem8[u16(src + 1)];
  advanceDisplayCursor(m, 1);
}
