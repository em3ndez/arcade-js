// SPDX-License-Identifier: GPL-3.0-only
/** emptyBothDeferredCellLists — empty both lists by parking each cursor back on its own first
 * entry, four bytes past the head the cursor occupies. Nothing is read, so what the lists held
 * stops being reachable rather than going away. LIVE-OUT: the two cursors, the second also in HL. */

import { DEFERRED_WRITE_CURSOR, DEFERRED_BLANK_CURSOR } from "./names.js";

const FIRST_ENTRY = 4;

export function emptyBothDeferredCellLists(m) {
  m.mem16[DEFERRED_BLANK_CURSOR] = DEFERRED_BLANK_CURSOR + FIRST_ENTRY;
  m.mem16[DEFERRED_WRITE_CURSOR] = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
  m.regs.hl = DEFERRED_WRITE_CURSOR + FIRST_ENTRY;
}
