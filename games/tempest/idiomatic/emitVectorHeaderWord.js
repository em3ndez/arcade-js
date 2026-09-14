// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

// Emit a two-byte vector word at the cursor origin -- first byte a, second byte x --
// then step the cursor past it. The shared tail reached with the pair preset.
export function emitVectorWord(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const ptr = mem16[DRAW_CURSOR_LO];
  mem8[ptr] = a;
  mem8[u16(ptr + 1)] = x;
  advanceDisplayCursor(m, 1);
}

// Write the fixed {0x40,0x80} header pair at the cursor, then step the cursor past it.
export function emitVectorHeaderWord(m) {
  return emitVectorWord(m, 0x40, 0x80);
}
