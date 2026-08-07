// SPDX-License-Identifier: GPL-3.0-only
/** freeAndNumberEveryObjectSlot — lay out a run of twenty-three records, sixteen bytes apart from a fixed start:
 * each record's first byte is cleared and its sixteenth is stamped with that record's position
 * in the run, counting from one. Nothing is read, so the run comes out the same however it went
 * in, and the stamped byte is what tells one record from another. LIVE-OUT: memory-only. */

const FIRST_RECORD = 0xa810;
const RECORD_BYTES = 16;
const RECORDS = 23;
const STATE = 0;
const NUMBER = 15;

export function freeAndNumberEveryObjectSlot(m) {
  const { mem8 } = m;
  for (let i = 0; i < RECORDS; i++) {
    const record = FIRST_RECORD + i * RECORD_BYTES;
    mem8[record + STATE] = 0;
    mem8[record + NUMBER] = i + 1;
  }
}
