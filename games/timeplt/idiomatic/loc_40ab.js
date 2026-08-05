// SPDX-License-Identifier: GPL-3.0-only
/** loc_40ab — zero `record`'s first byte and `entry`'s two coordinate bytes, one at its base
 * and one 49 further on: a slot's bookkeeping and its position go out together, which is the
 * whole of "retire". Both bases are PARAMETERS, so WHAT retires is the caller's. LIVE-OUT: memory. */

const SECOND_AXIS_OFFSET = 49;

export function loc_40ab(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  mem8[record] = 0;
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
}
