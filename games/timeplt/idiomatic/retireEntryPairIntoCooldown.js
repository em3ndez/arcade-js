// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireEntryPairIntoCooldown — clear a record and the PAIR of sprite entries that belong to it, then set the
 * fifteenth byte of the record to a fixed value instead of leaving it clear. Five cells go to zero: the record's
 * first byte, and both coordinates of each of two neighbouring entries, the second coordinate lying forty-nine
 * bytes past the first in a parallel table. Nothing is read, so what this does cannot depend on anything in the
 * machine and a second run changes nothing; how long the value it leaves standing lasts is not decidable here.
 * LIVE-OUT: memory, plus the zero left in the accumulator.
 */

const NEXT_ENTRY = 2;
const SECOND_AXIS = 49;
const RECORD_BYTE = 14;
const RECORD_CODE = 95;

export function retireEntryPairIntoCooldown(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  const entry = regs.iy;
  regs.a = 0;
  mem8[record] = 0;
  mem8[entry] = 0;
  mem8[entry + NEXT_ENTRY] = 0;
  mem8[entry + SECOND_AXIS] = 0;
  mem8[entry + SECOND_AXIS + NEXT_ENTRY] = 0;
  mem8[record + RECORD_BYTE] = RECORD_CODE;
}
