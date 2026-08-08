// SPDX-License-Identifier: GPL-3.0-only
/** loc_28cd — aim the record cursor at one craft's state block and the display cursor at the two
 * bytes that block drives, then run the arm the era selects. Nothing here reads or writes memory;
 * the pair of cursors is the whole of what this entry contributes. LIVE-OUT: memory, and the arm's. */

import { loc_290e } from "./loc_290e.js";

const CRAFT_RECORD = 0xa870;
const DISPLAY_ENTRY = 0xaa1e;

export function loc_28cd(m) {
  const { regs } = m;
  regs.ix = CRAFT_RECORD;
  regs.iy = DISPLAY_ENTRY;
  return loc_290e(m);
}
