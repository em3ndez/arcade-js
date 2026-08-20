// SPDX-License-Identifier: GPL-3.0-only
/**
 * splitBcdByte — split a packed-BCD byte into two decimal digits: write the LOW nibble
 * (units) as a tile at dst, advance the cursor by `advance`, and return the HIGH nibble.
 * The caller uses the high digit; high === 0 is the leading-zero test (the old Z-flag
 * signal). A pure leaf: one read, one write.
 *
 * LIVE-OUT: returns { high, next } — next = dst + advance; the low digit is written at dst.
 */
import { u16 } from "../../../core/int.js";

export function splitBcdByte(m, src = m.regs.ix, dst = m.regs.hl, advance = m.regs.de) {
  const { mem8 } = m;

  const byte = mem8[src];
  mem8[dst] = byte & 0x0f; //               low nibble (units digit) -> tile at the cursor
  const next = u16(dst + advance);
  const high = (byte >> 4) & 0x0f; //       high nibble (tens digit) handed back; zero => Z-sense
  return { high, next };
}
