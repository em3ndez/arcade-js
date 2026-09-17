// SPDX-License-Identifier: GPL-3.0-only
/** advanceToNextSlot — step a caller's pair of cursors on to the next slot, which owns
 * a record in one table and an entry in a parallel one, so the strides differ while the slot
 * index they share survives. Nothing is read, written or clamped. LIVE-OUT: the two cursors. */

import { u16 } from "../../../core/int.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function advanceToNextSlot(m, record = m.regs.ix, entry = m.regs.iy) {
  // both cursors are register-dispatched live-outs read straight back by the frozen translated caller.
  return [m.regs.ix = u16(record + RECORD_STRIDE), m.regs.iy = u16(entry + ENTRY_STRIDE)];
}
