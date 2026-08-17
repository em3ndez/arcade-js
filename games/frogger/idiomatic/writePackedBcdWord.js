// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdWord — print a 16-bit packed-BCD value as four tilemap digits: the high byte's two, then the low.
 * LIVE-OUT: memory + HL (the write pointer stepped up four rows for the caller's next field).
 */
import { writePackedBcdByte } from "./writePackedBcdByte.js";

export function writePackedBcdWord(m, value = m.regs.de, ptr = m.regs.hl) {
  const p = writePackedBcdByte(m, value >> 8, ptr);
  return writePackedBcdByte(m, value & 0xff, p);
}
