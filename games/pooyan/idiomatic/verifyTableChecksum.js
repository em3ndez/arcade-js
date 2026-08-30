// SPDX-License-Identifier: GPL-3.0-only
/**
 * verifyTableChecksum — an image-integrity tripwire. ROM 0x585b. [seen]
 *
 * The other half of the board's anti-tamper self-test (companion to verifyRomSignature's
 * sparse fingerprint): a true additive checksum. It reads `count` consecutive bytes starting
 * at `ptr` and adds them into a 16-bit running total held across two registers — `low` is the
 * low byte, `high` the high byte — carrying from low into high exactly as the Z80 does, one
 * bump of `high` per 8-bit overflow. That reproduces a plain 16-bit sum of the byte run.
 *
 * The caller seeds the run: `ptr` (HL) is the table start, `count` (B) its length, and `low`
 * (A) / `high` (D) the starting accumulator (normally 0). A genuine, unmodified table sums to
 * one specific 16-bit constant — high byte 0x1d, low byte 0xc1 (i.e. 0x1dc1). On that exact
 * total the routine returns quietly, meaning "table intact". ANY other total means a byte was
 * altered, so it raises the tamper cell SCORE_DRIP_ACCUM (0x882b) to 1. That cell is polled by
 * the main-loop timeout handler (0x114f) and by the round-5 tamper check (0x5b06): a nonzero
 * value feeds the freeze/tally logic that punishes a modified image, so a bootleg fails the
 * checksum here and gets wedged later rather than at the point of detection.
 *
 * LIVE-OUT: memory only. On a mismatch it raises the tamper cell; the accumulator
 * registers are scratch and no caller reads them.
 */
import { u8, u16 } from "../../../core/int.js";
import { SCORE_DRIP_ACCUM } from "./names.js";

export function verifyTableChecksum(m, ptr = m.regs.hl, count = m.regs.b, low = m.regs.a, high = m.regs.d) {
  const { mem8 } = m;

  // Sum the byte run into the split 16-bit accumulator (low:high), one byte per pass.
  let p = ptr;
  for (let i = 0; i < count; i++) {
    const total = low + mem8[p];
    if (total > 0xff) high = u8(high + 1); // 8-bit carry rolls into the high byte
    low = u8(total);                       // keep only the low 8 bits of the running total
    p = u16(p + 1);                        // next table byte, 16-bit wrap
  }

  // The one accepted total for the genuine table is 0x1dc1. Match => return, table intact.
  if (low === 0xc1 && high === 0x1d) return; // high 0x1d, low 0xc1: table intact
  // Any other total means the table's bytes were altered: arm the tamper tripwire. The
  // freeze/tally logic elsewhere reads this cell and punishes the modified image later.
  mem8[SCORE_DRIP_ACCUM] = 1;
}
