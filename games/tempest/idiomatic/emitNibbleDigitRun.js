// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, NIBBLE_EMIT_COUNT, NIBBLE_EMIT_INDEX } from "./names.js";
import { emitStrokeWordFromNibble } from "./emitStrokeWordFromNibble.js";

/**
 * emitNibbleDigitRun — emit a run of packed zeropage bytes as high/low nibble glyph words. ROM 0xdfb1.
 *
 * Role in the machine: a display-list helper that renders a contiguous run of packed BCD-style bytes (each
 * holding two 4-bit digits/glyphs) into vector strokes. Callers hand it a base A and a length Y; it walks
 * the run from the top byte (base index a+y-1) downward, emitting each byte's high nibble then its low
 * nibble via the glyph-word lookup emitStrokeWordFromNibble. It chains a carry through the whole run so that
 * only the very last low nibble is emitted with carry cleared — that cleared-carry emit is the run's
 * terminator marker in the vector stream.
 *
 * Behaviour: seed count = y-1 (stored in NIBBLE_EMIT_COUNT / loc scratch) and the working index x = a+count
 * (the top byte), with carry = true. Each pass: save x (NIBBLE_EMIT_INDEX), fetch the packed byte at
 * GAME_MODE+x (loc_00 base), emit its high nibble with the current carry, then compute the low nibble's
 * carry — normally carry propagates only while a nibble was zero, but on the last byte (count==0) the low
 * nibble's carry is forced clear (the terminator). Emit the low nibble, recompute carry for the next byte
 * from whether this low nibble was zero, decrement x and count (both round-tripped through their scratch
 * cells), and loop while count stays below 0x80 (i.e. has not wrapped negative).
 *
 * Live-out: the appended stroke words in the vector list; NIBBLE_EMIT_COUNT and NIBBLE_EMIT_INDEX left at
 * their post-loop (wrapped) values as dead scratch. Grounding: [seen].
 */
export function emitNibbleDigitRun(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  let count = (y - 1) & 0xff;
  mem8[NIBBLE_EMIT_COUNT] = count;
  let x = (a + count) & 0xff;
  let carry = true;
  do {
    mem8[NIBBLE_EMIT_INDEX] = x;
    const byte = mem8[u16(GAME_MODE + x)];
    const high = byte >> 4;
    emitStrokeWordFromNibble(m, high, carry);
    const carryHigh = carry && high === 0;
    const last = count === 0;
    const carryLow = last ? false : carryHigh;
    emitStrokeWordFromNibble(m, byte, carryLow);
    carry = carryLow && (byte & 0x0f) === 0;
    x = (mem8[NIBBLE_EMIT_INDEX] - 1) & 0xff;
    count = (mem8[NIBBLE_EMIT_COUNT] - 1) & 0xff;
    mem8[NIBBLE_EMIT_COUNT] = count;
  } while (count < 0x80);
}
