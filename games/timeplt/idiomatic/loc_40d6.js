// SPDX-License-Identifier: GPL-3.0-only
/** loc_40d6 — enter the per-slot sweep of an object bank: below era 2, or with the bank's slot count
 * zero, do nothing; else seat both cursors and the turn count and run the sweep body. LIVE-OUT: memory. */

const FIRST_SWEPT_ERA = 2;
const ERA_INDEX = 0xad04;
const SLOT_COUNT = 0xa8c6;
const RECORD_CURSOR_SEAT = 0xa8c0;
const ENTRY_CURSOR_SEAT = 0xaa28;
const SWEEP_BODY = 0x40ea;

export function loc_40d6(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;

  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;

  const count = mem8[SLOT_COUNT];
  if (count === 0) return;

  regs.b = count;
  return m.call(SWEEP_BODY);
}
