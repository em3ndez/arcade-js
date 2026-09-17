// SPDX-License-Identifier: GPL-3.0-only
/** eraseTextRunByIndex — blank out the caption one record describes. The record is picked by number out of a
 * table of record addresses; its first two bytes name the cell to start from and the byte after
 * them is stepped over unread. Each byte of the run that follows is read only to test it against
 * the code that ends the run — the byte WRITTEN is always the same blank, so what the caption said
 * makes no difference to what replaces it — and the cursor steps one cell along the line after
 * every one. A run that is empty writes nothing. Only one plane is written; the cell's colour is
 * left standing, so a blanked caption keeps whatever tint it had. LIVE-OUT: memory; the cursor left
 * standing where the run ended (DE); the run pointer left on the terminator (HL); the terminator
 * byte in A and the flags of matching it. */

import { u16 } from "../../../core/int.js";
import { F_F3, F_F5, F_N, F_Z } from "../../../core/cpu/z80.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { CAPTION_RECORD_TABLE } from "./names.js";

const RUN_STARTS_AT = 3;
const END_OF_TEXT = 185;
const BLANK = 241;
// Matching the terminator against itself: zero result, subtract flag set, and the F3/F5 bits the
// terminator value itself carries (a compare takes its undocumented bits from the operand).
const TERMINATED_FLAGS = F_Z | F_N | F_F3 | F_F5;

export function eraseTextRunByIndex(m, recordNumber = m.regs.a) {
  const { mem8 } = m;
  const record = fetchWideTableWord(m, CAPTION_RECORD_TABLE, recordNumber);
  let cursor = m.mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[cursor] = BLANK;
    next = u16(next + 1);
    cursor = advanceCharCursor(m, cursor);
  }
  return (m.regs.a = END_OF_TEXT, m.regs.f = TERMINATED_FLAGS, m.regs.hl = next, m.regs.de = cursor, undefined);
}
