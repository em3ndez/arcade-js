// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWord } from "./emitVectorHeaderWord.js";

/**
 * emitVectorWordTag70 — emit a vector word with the high byte tagged 0x70. ROM 0xdf6c.
 *
 * Role in the machine: another one-line wrapper over emitVectorWord for the display-list builders.
 * The 0x70 header bits mark this word's class to the vector generator; callers pass the `y` payload
 * (which becomes the first/low byte) and the `a` payload (which becomes the second/high byte after
 * OR-ing in 0x70), and the word is laid at the draw cursor ($74) with the cursor stepped past it.
 *
 * Live-out: one 0x70-tagged word in the display list, DRAW_CURSOR_LO advanced two. Grounding: [seen]
 */
export function emitVectorWordTag70(m, a = m.regs.a, y = m.regs.y) {
  return emitVectorWord(m, y, a | 0x70); // low byte = y payload, high byte = a payload tagged 0x70
}
