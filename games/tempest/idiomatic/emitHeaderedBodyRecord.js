// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO } from "./names.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitRecordTailByte } from "./emitCoordinateRecord.js";

/**
 * emitHeaderedBodyRecord -- emit a header word, then a one-byte body record. ROM 0xdf0d.
 *
 * Role in the machine: a display-list record builder used by the self-test frame drawer (runSelfTestLoop)
 * and the draw-handler dispatch. It lays a fixed vector header word and then a record whose body is the
 * constant byte 0x20, so the AVG draws a known fixed shape.
 *
 * Behavior: emitVectorHeaderWord writes the header pair (the {0x40,0x80} header) through the draw cursor
 * 0x74. It then tails into emitRecordBodyByte with the immediate body byte 0x20.
 *
 * Live-out: a header word plus a body record appended at the draw cursor. Grounding: [seen].
 */
export function emitHeaderedBodyRecord(m) {
  emitVectorHeaderWord(m);        // lay the header pair through cursor 0x74
  return emitRecordBodyByte(m, 0x20); // body byte is the constant 0x20
}

/**
 * emitRecordBodyByte -- store one body byte at the cursor origin and run the shared record tail. ROM 0xdf12.
 *
 * Role in the machine: the shared body-write step for the record builders above. The byte defaults to the
 * accumulator (A) so the routine can be entered directly with whatever value the caller computed.
 *
 * Behavior: store A at the display cursor origin (cursor 0x74 + 0 via the 16-bit cursor read), then
 * continue into the shared record tail (emitRecordTailByte at 0xdfac) with the same value and a zero
 * offset. Grounding: [seen].
 */
export function emitRecordBodyByte(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[mem16[DRAW_CURSOR_LO]] = a;   // store at cursor + 0
  return emitRecordTailByte(m, a, 0); // hand off to the shared record tail
}
