// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagTamperOnRound5ChecksumMiss — anti-tamper checksum guard, armed only at round 5.
 *
 * When ROUND_COUNTER == 5, sum six program bytes, carrying each overflow into a separate carry
 * count. If (low sum + carry count + 0x7f) is nonzero — the checksum does not balance, i.e. the
 * image was altered — bump TAMPER_FREEZE_FLAG, the strike tally downstream code reads to freeze
 * spawns. At any other round it returns having touched nothing.
 *
 * LIVE-OUT: memory only. The caller ignores A and the flags; the sole effect a reader sees is the
 * possible increment of TAMPER_FREEZE_FLAG.
 */
import { ROUND_COUNTER, TAMPER_FREEZE_FLAG } from "./names.js";
import { u8 } from "../../../core/int.js";

const GUARDED_ROUND = 0x05;
const CHECKSUM_LEN = 0x06;
const CHECKSUM_BIAS = 0x7f; // an intact image is tuned so (low sum + carry count + bias) wraps to 0

// Six-byte span the sum covers, its base built byte-swapped (high 0x15, low 0x53) as the guard does.
const CHECKSUM_SRC = (0x15 << 8) | 0x53;

export function flagTamperOnRound5ChecksumMiss(m) {
  const { mem8 } = m;

  if (mem8[ROUND_COUNTER] !== GUARDED_ROUND) return;

  let lowSum = 0;
  let carryCount = 0;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    const total = lowSum + mem8[CHECKSUM_SRC + i];
    if (total > 0xff) carryCount = u8(carryCount + 1);
    lowSum = u8(total);
  }

  if (u8(lowSum + carryCount + CHECKSUM_BIAS) === 0) return; // checksum balances -> not tampered
  mem8[TAMPER_FREEZE_FLAG] = mem8[TAMPER_FREEZE_FLAG] + 1;
}
