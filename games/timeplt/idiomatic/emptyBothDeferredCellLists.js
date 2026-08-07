// SPDX-License-Identifier: GPL-3.0-only
/** emptyBothDeferredCellLists — empty both lists by parking each one's cursor back on its own
 * first entry, four bytes past the head where the cursor itself lives. Nothing is read and nothing
 * else is touched, so whatever the lists held stops being reachable rather than going away.
 * LIVE-OUT: the two cursors, plus the second of them left standing in a register pair. */

import { DEFERRED_WRITE_CURSOR } from "./names.js";

const FIRST_LIST = 0xae80;
const FIRST_ENTRY = 4;

export function emptyBothDeferredCellLists(m) {
  m.mem16[FIRST_LIST] = FIRST_LIST + FIRST_ENTRY;
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
  m.regs.hl = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
}
