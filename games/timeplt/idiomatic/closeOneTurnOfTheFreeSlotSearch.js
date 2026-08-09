// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheFreeSlotSearch — step both cursors BACKWARD one whole element and strike one off
 * the count; while any remain, hand control back to the body that works one slot, else just return. LIVE-OUT: the cursors, the count. */

import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function closeOneTurnOfTheFreeSlotSearch(m) {
  const { regs } = m;
  regs.ix = regs.ix - RECORD_STRIDE;
  regs.iy = regs.iy - ENTRY_STRIDE;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return spawnEnemyIntoFreeSlotElseStepSearch(m);
}
