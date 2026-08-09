// SPDX-License-Identifier: GPL-3.0-only
/** loc_3793 — seat the count and the two cursors on the highest of five consecutive object slots,
 * then transfer into the body that fills the first free one; all three are constants. LIVE-OUT: the count, the two cursors. */

import { loc_37d6 } from "./loc_37d6.js";

const SLOTS_IN_THE_PASS = 5;
const RECORD_CURSOR_SEAT = 0xa890;
const ENTRY_CURSOR_SEAT = 0xaa22;

export function loc_3793(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  return loc_37d6(m);
}
