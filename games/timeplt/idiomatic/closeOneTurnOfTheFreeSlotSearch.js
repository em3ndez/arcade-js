// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheFreeSlotSearch — close one turn of a pass over object slots and decide whether there is another.
 * Both cursors step BACKWARD, each by one whole element, so the pass walks its bank downward. One
 * turn is struck off the count, and while any remain control goes back to the body that works one
 * slot; when the last is struck off the pass is over and this entry just returns. The scratch the
 * backward step is built from is not reproduced. LIVE-OUT: the cursors, the count, the body's. */

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
const SLOT_BODY = 0x37d6;

export function closeOneTurnOfTheFreeSlotSearch(m) {
  const { regs } = m;
  regs.ix = regs.ix - RECORD_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(SLOT_BODY);
}
