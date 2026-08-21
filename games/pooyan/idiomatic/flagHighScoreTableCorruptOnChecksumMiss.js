// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagHighScoreTableCorruptOnChecksumMiss — high-score-table checksum guard.
 *
 * The header byte of the 4-byte checksum block must be the 0xc8 marker; then the four bytes are
 * summed (each byte-carry counted separately) and the total minus that carry count must equal 0x59.
 * A bad header or a mismatched total means the table was altered, so raise the corrupt flag. When
 * the checksum balances it returns having touched nothing.
 *
 * LIVE-OUT: memory only — the sole durable effect is raising HISCORE_TABLE_CORRUPT_FLAG. (At the
 * final return A holds 0x59/0x01 and Z encodes trusted/corrupt, but no identified caller reads them.)
 */
import { HISCORE_CHECKSUM_BASE, HISCORE_TABLE_CORRUPT_FLAG } from "./names.js";
import { u8 } from "../../../core/int.js";

const HEADER_MARKER = 0xc8; // required first byte of the checksum block
const CHECKSUM_TARGET = 0x59; // summed bytes minus carry count, when the table is trusted
const CHECKSUM_LEN = 0x04;

export function flagHighScoreTableCorruptOnChecksumMiss(m) {
  const { mem8 } = m;

  if (mem8[HISCORE_CHECKSUM_BASE] !== HEADER_MARKER) {
    mem8[HISCORE_TABLE_CORRUPT_FLAG] = 0x01; // bad header -> corrupt
    return;
  }

  let sum = mem8[HISCORE_CHECKSUM_BASE];
  let carryCount = 0;
  for (let i = 1; i < CHECKSUM_LEN; i++) {
    const total = sum + mem8[HISCORE_CHECKSUM_BASE + i];
    if (total > 0xff) carryCount = u8(carryCount + 1);
    sum = u8(total);
  }

  if (u8(sum - carryCount) === CHECKSUM_TARGET) return; // checksum balances -> trusted
  mem8[HISCORE_TABLE_CORRUPT_FLAG] = 0x01;
}
