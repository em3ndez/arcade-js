// SPDX-License-Identifier: GPL-3.0-only
/** loc_018c — fetch the two-byte entry sitting at a given index of a table and hand it back as
 * the routine's one result. The index is scaled by the entry width before it is added to the
 * base, and the sum wraps inside the address space. Nothing is written.
 * LIVE-OUT: the fetched value alone; the base and the index are left where they were. */

import { u16 } from "../../../core/int.js";

const ENTRY_WIDTH = 2;

export function loc_018c(m) {
  const { regs } = m;
  const table = regs.hl;
  const index = regs.a;
  regs.de = m.mem16[u16(table + ENTRY_WIDTH * index)];
}
