// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagHighScoreTableCorruptOnChecksumMiss — the high-score-table integrity guard.
 *
 * ROM 0x0644-0x066c. Grounding: [seen].
 *
 * WHAT IT IS. A tiny self-check the machine runs once per attract cycle over the four-byte
 * checksum block that guards the persistent high-score table. Arcade boards keep the top-score
 * list in battery-backed or otherwise trusted RAM, and a garbled entry would render as junk on
 * the attract screen; this routine decides whether the stored table can be believed before it
 * is drawn, and if not, it sets a flag that downstream code reads to fall back to the built-in
 * default table instead of the corrupted one.
 *
 * HOW IT DECIDES. The block lives at HISCORE_CHECKSUM_BASE (ROM 0x778a). Its first byte is a
 * fixed 0xc8 header marker. The routine then adds all four bytes of the block together as an
 * 8-bit accumulator, counting separately how many times that addition carried out of the byte
 * (each carry is a "wrap past 0xff"). The table is trusted only when BOTH conditions hold:
 *   - the header byte is exactly 0xc8, and
 *   - (sum of the four bytes) minus (the carry count) equals 0x59.
 * The 0xc8 header and the 0x59 target are the values baked into an intact image; any edit to
 * the block breaks one or the other. On success it returns having written nothing. On either
 * failure it raises HISCORE_TABLE_CORRUPT_FLAG (ROM 0x8df8) to 1.
 *
 * LIVE-OUT: memory only — the sole durable effect is raising HISCORE_TABLE_CORRUPT_FLAG. (At
 * the final return the accumulator holds 0x59 or 0x01 and the zero flag encodes trusted vs.
 * corrupt, but no identified caller reads them.)
 */
import { HISCORE_CHECKSUM_BASE, HISCORE_TABLE_CORRUPT_FLAG } from "./names.js";
import { u8 } from "../../../core/int.js";

const HEADER_MARKER = 0xc8; // required first byte of the checksum block (the 0xc8 marker at 0x778a)
const CHECKSUM_TARGET = 0x59; // (summed bytes − carry count) must equal this when the table is trusted
const CHECKSUM_LEN = 0x04; // the block is four bytes: the header plus three payload bytes

export function flagHighScoreTableCorruptOnChecksumMiss(m) {
  const { mem8 } = m;

  // Gate 1: the block must open with the fixed 0xc8 header marker. A byte other than 0xc8 at
  // HISCORE_CHECKSUM_BASE means the block is not even the right shape, so flag corrupt and stop
  // before wasting the sum.
  if (mem8[HISCORE_CHECKSUM_BASE] !== HEADER_MARKER) {
    mem8[HISCORE_TABLE_CORRUPT_FLAG] = 0x01; // bad header -> corrupt
    return;
  }

  // Sum all four bytes of the block into an 8-bit accumulator, seeding it with the header byte
  // itself (0xc8) and then folding in the three payload bytes. Every time the running total
  // overflows past 0xff the hardware add sets carry; the routine tallies those carries so the
  // full 8-bit-plus-carry weight of the sum can be recovered below.
  let sum = mem8[HISCORE_CHECKSUM_BASE];
  let carryCount = 0;
  for (let i = 1; i < CHECKSUM_LEN; i++) {
    const total = sum + mem8[HISCORE_CHECKSUM_BASE + i];
    if (total > 0xff) carryCount = u8(carryCount + 1); // count this overflow
    sum = u8(total); // keep only the low byte, as the 8-bit accumulator does
  }

  // Gate 2: an intact block is tuned so that (low sum − carry count) lands on exactly 0x59.
  // If it does, the table is trusted and the routine returns untouched; otherwise it too is a
  // corruption, so fall through and raise the flag.
  if (u8(sum - carryCount) === CHECKSUM_TARGET) return; // checksum balances -> trusted
  mem8[HISCORE_TABLE_CORRUPT_FLAG] = 0x01;
}
