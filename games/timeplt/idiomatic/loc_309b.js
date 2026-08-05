// SPDX-License-Identifier: GPL-3.0-only
/** loc_309b — step a caller's pair of cursors on to the next object, which owns
 * a record in one table and an entry in a parallel one, so the strides differ while the slot
 * index they share survives. Nothing is read, written or clamped. LIVE-OUT: the two cursors. */

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function loc_309b(m) {
  const { regs } = m;
  regs.ix = regs.ix + RECORD_STRIDE;
  regs.iy = regs.iy + ENTRY_STRIDE;
}
