// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { beginTwoPlayerStartOfLife } from "./beginTwoPlayerStartOfLife.js";
import { startOnePlayerGameOnCredit } from "./startOnePlayerGameOnCredit.js";
import {
  INPUT_PORT0,
  CREDIT_COUNT,
  CREDIT_CHECKSUM_TABLE,
  CREDIT_TAMPER_COUNTER,
} from "./names.js";
/**
 * startSelectedPlayerGameConsumingCredits — coin/credit post-handler on the IN0 edge bits (INPUT_PORT0).
 *
 * Bit 3 (1P-start) hands off to the 1P-start sub-handler. Otherwise, unless bit 4 (2P-start) is set
 * it returns. With bit 4 set it consumes two credits (returning early if fewer than two), then runs
 * an integrity checksum over CREDIT_CHECKSUM_TABLE (16-bit sum with byte-carries counted): when the
 * folded result is nonzero it bumps a tamper counter. Either way it continues into the start-of-life
 * entry.
 *
 * LIVE-OUT: none — memory only; the tail continues into the start-of-life entry.
 */
const CHECKSUM_LEN = 0x14;
const FOLD_MASK = 0xab;

export function startSelectedPlayerGameConsumingCredits(m) {
  const { mem8 } = m;

  const in0 = mem8[INPUT_PORT0];
  if (in0 & 0x08) return startOnePlayerGameOnCredit(m); // bit 3: 1P-start branch
  if ((in0 & 0x10) === 0) return; // bit 4 clear: nothing to do
  const credits = mem8[CREDIT_COUNT];
  if (credits < 2) return;
  mem8[CREDIT_COUNT] = credits - 2;

  let sum = CHECKSUM_LEN; // E seeded from the byte count
  let carry = CHECKSUM_LEN; // D seeded from E
  let ptr = CREDIT_CHECKSUM_TABLE;
  for (let n = CHECKSUM_LEN; n > 0; n--) {
    const t = sum + mem8[ptr];
    if (t > 0xff) carry = u8(carry + 1);
    sum = t & 0xff;
    ptr = u16(ptr + 1);
  }
  if ((u8(sum + carry) & FOLD_MASK) !== 0) {
    mem8[CREDIT_TAMPER_COUNTER] = u8(mem8[CREDIT_TAMPER_COUNTER] + 1);
  }
  return beginTwoPlayerStartOfLife(m);
}
