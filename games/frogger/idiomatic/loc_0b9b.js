// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b9b — print a 16-bit packed-BCD value as four tilemap digits: the high byte's two, then the low.
 * LIVE-OUT: memory + HL (the write pointer stepped up four rows for the caller's next field).
 */
import { writePackedBcdByte } from "./writePackedBcdByte.js";

export function loc_0b9b(m) {
  const { regs } = m;
  const value = regs.de;

  regs.a = value >> 8;
  writePackedBcdByte(m);

  regs.a = value & 0xff;
  return writePackedBcdByte(m);
}
