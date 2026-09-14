// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { VG_RECORD_HEADER, DRAW_CURSOR_LO } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";

/**
 * emitCoordinateVectorWord — pack two scalars into one tagged vector-generator word and
 * write it out through the draw cursor. ROM 0xdf39.
 *
 * Role in the machine: another primitive that lays a single word into the vector display
 * list Tempest hands the Atari vector generator. It builds the two-byte word from the
 * accumulator a and index x using the 6502 rotate-right idiom: the low bit of a is the
 * carry that feeds the low byte, a's remaining upper nibble becomes the high byte tagged
 * with the generator opcode 0xa0, and x shifted right forms the rest of the low byte. The
 * result is a coordinate/opcode word the generator reads when it walks the list.
 *
 * Behavior: carry = a&1. hi = ((a>>1)&0x0f) | 0xa0 — a's upper nibble with the 0xa0 vector
 * opcode tag forced in. lo = ((carry<<7) | (x>>1)) & 0xff — x rotated right with a's old
 * bit0 rotated into bit7. Through the cursor loc_74: store hi at ptr+1, then lo at ptr+0.
 * Set y back to 1; if nonzero, tail-call advanceDisplayCursor(m, 1); on a cursor wrap to
 * zero instead tail-call emitTaggedVectorWord(lo, key loc_73) to close the record.
 *
 * Live-out: two bytes written through the draw cursor at ptr+0 (lo) and ptr+1 (hi), plus the
 * advanced cursor / record state from the tail call. Grounding: [seen].
 */
export function emitCoordinateVectorWord(m, a = m.regs.a, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const carry = a & 0x01;
  // High byte: a's upper nibble tagged with the 0xa0 vector opcode. Low byte: x>>1 with a's
  // old bit0 rotated into bit7 (the 6502 ROR-through-carry pattern).
  const hi = ((a >> 1) & 0x0f) | 0xa0;
  const lo = ((carry << 7) | (x >> 1)) & 0xff;
  const ptr = mem16[DRAW_CURSOR_LO];
  let y = 0x01;
  mem8[u16(ptr + y)] = hi;      // hi at ptr+1
  y = (y - 1) & 0xff;
  mem8[u16(ptr + y)] = lo;      // lo at ptr+0
  y = (y + 1) & 0xff;
  // Nonzero index: advance the cursor. Wrap to zero: close with the tagged-word tail.
  if (y !== 0) return advanceDisplayCursor(m, y);
  return emitTaggedVectorWord(m, lo, mem8[VG_RECORD_HEADER]);
}
