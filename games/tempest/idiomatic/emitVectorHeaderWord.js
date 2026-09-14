// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * emitVectorWord — lay one two-byte word into the vector display list. ROM 0xdf57.
 *
 * Role in the machine: Tempest is a vector game; every frame the CPU builds a display list in
 * "vector RAM" that the Analog Vector Generator then walks to sweep the beam. This is the lowest
 * builder primitive: it writes a single AVG word — first byte `a`, second byte `x` — at the current
 * draw cursor and steps the cursor past it, so callers can chain words to compose a shape.
 *
 * Behavior: read the 16-bit write cursor from DRAW_CURSOR_LO ($74/$75), store `a` at cursor+0 and
 * `x` at cursor+1, then advanceDisplayCursor(m, 1) bumps the cursor two bytes forward (Y+1 with the
 * 6502 carry forced, so +2). This is the shared tail other emitters reach with the pair preset.
 *
 * Live-out: two bytes written into the display list, DRAW_CURSOR_LO advanced by two. Grounding: [seen]
 */
export function emitVectorWord(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const ptr = mem16[DRAW_CURSOR_LO]; // the 16-bit vector-RAM write cursor $74/$75
  mem8[ptr] = a;                     // low byte of the word
  mem8[u16(ptr + 1)] = x;            // high byte of the word
  advanceDisplayCursor(m, 1);        // step the cursor two bytes past the emitted word
}

/**
 * emitVectorHeaderWord — emit the fixed {0x40,0x80} beam-position header word. ROM 0xdf53.
 *
 * Role in the machine: many object records in the vector list open with a canonical header word that
 * primes the vector generator before the coordinate payload follows. This convenience wraps
 * emitVectorWord with the constant pair 0x40 (low) / 0x80 (high) so callers get that header without
 * carrying the literals. Live-out: the header word laid at the cursor, cursor advanced two. Grounding: [seen]
 */
export function emitVectorHeaderWord(m) {
  return emitVectorWord(m, 0x40, 0x80);
}
