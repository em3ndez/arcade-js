// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_CURSOR_LO } from "./names.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitRecordTailByte } from "./emitCoordinateRecord.js";

// Emit the header pair, then store a fixed body byte at the cursor origin before running
// the shared record tail.
export function emitHeaderedBodyRecord(m) {
  emitVectorHeaderWord(m);
  return emitRecordBodyByte(m, 0x20);
}

// Store one body byte at the cursor origin, then continue the shared record tail.
export function emitRecordBodyByte(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  mem8[mem16[DRAW_CURSOR_LO]] = a;   // store at cursor + 0
  return emitRecordTailByte(m, a, 0);
}
