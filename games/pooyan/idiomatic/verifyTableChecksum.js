// SPDX-License-Identifier: GPL-3.0-only
/**
 * verifyTableChecksum — an image-integrity tripwire. Sum `count` bytes from `ptr` into a
 * 16-bit accumulator (low byte + high byte, the high byte bumped on each 8-bit carry).
 * The table is intact only when the sum's high byte is 0x1d and its low byte 0xc1; on
 * that match it returns quietly, and on ANY other total it raises the tamper flag.
 *
 * LIVE-OUT: memory only. On a mismatch it raises the tamper flag; the accumulator
 * registers are scratch and no caller reads them.
 */
import { u8, u16 } from "../../../core/int.js";
import { SCORE_DRIP_ACCUM } from "./names.js";

export function verifyTableChecksum(m, ptr = m.regs.hl, count = m.regs.b, low = m.regs.a, high = m.regs.d) {
  const { mem8 } = m;

  let p = ptr;
  for (let i = 0; i < count; i++) {
    const total = low + mem8[p];
    if (total > 0xff) high = u8(high + 1); // 8-bit carry rolls into the high byte
    low = u8(total);
    p = u16(p + 1);
  }

  if (low === 0xc1 && high === 0x1d) return; // high 0x1d, low 0xc1: table intact
  mem8[SCORE_DRIP_ACCUM] = 1;
}
