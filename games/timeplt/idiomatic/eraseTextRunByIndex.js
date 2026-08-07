// SPDX-License-Identifier: GPL-3.0-only
/** eraseTextRunByIndex — blank out the caption one record describes. The record is picked by number out of a
 * table of record addresses; its first two bytes name the cell to start from and the byte after
 * them is stepped over unread. Each byte of the run that follows is read only to test it against
 * the code that ends the run — the byte WRITTEN is always the same blank, so what the caption said
 * makes no difference to what replaces it — and the cursor steps one cell along the line after
 * every one. A run that is empty writes nothing. Only one plane is written; the cell's colour is
 * left standing, so a blanked caption keeps whatever tint it had. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";

const RECORD_TABLE = 0x0c50;
const RUN_STARTS_AT = 3;
const END_OF_TEXT = 185;
const BLANK = 241;

export function eraseTextRunByIndex(m, recordNumber = m.regs.a) {
  const { mem8, mem16, regs } = m;
  regs.hl = RECORD_TABLE;
  regs.a = recordNumber;
  fetchWideTableWord(m);

  const record = regs.de;
  regs.de = mem16[record];
  let next = u16(record + RUN_STARTS_AT);
  while (mem8[next] !== END_OF_TEXT) {
    mem8[regs.de] = BLANK;
    next = u16(next + 1);
    advanceCharCursor(m);
  }
}
