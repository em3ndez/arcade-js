// SPDX-License-Identifier: GPL-3.0-only
/** loc_3793 — start a pass over a fixed bank of object slots. A slot owns a record in one table
 * and an entry in a parallel one, so the pass carries a cursor on each and a count of the slots it
 * covers. All three are constants chosen here: nothing is read and nothing is written. Control then
 * leaves for the body that works one slot and does not come back, so those three are the whole of
 * what this entry gives it. LIVE-OUT: the count, the two cursors, and whatever the body leaves. */

const SLOTS_IN_THE_PASS = 5;
const RECORD_CURSOR_SEAT = 0xa890;
const ENTRY_CURSOR_SEAT = 0xaa22;
const SLOT_BODY = 0x37d6;

export function loc_3793(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  return m.call(SLOT_BODY);
}
