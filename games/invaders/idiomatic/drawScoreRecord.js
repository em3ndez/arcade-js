// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdWord } from "./drawBcdWord.js";

// Unpack a four-byte score record at HL -- a BCD value word (low then high) followed by its two-byte
// screen address -- and draw that value as four BCD glyphs at the address.
export function drawScoreRecord(m, hl = m.regs.hl) {
  const e = m.mem8[hl];
  const d = m.mem8[hl + 1];
  const a = m.mem8[hl + 2];
  const h = m.mem8[hl + 3];
  return (m.regs.hl = (h << 8) | a, drawBcdWord(m, d, e));
}
