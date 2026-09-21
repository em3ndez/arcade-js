// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheFreeSlotSearch — step both cursors BACKWARD one whole element and strike one off
 * the count; while any remain, hand control back to the body that works one slot, else just return. LIVE-OUT: the cursors, the count. */

import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function closeOneTurnOfTheFreeSlotSearch(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { regs } = m;
  const nextB = regs.b - 1;
  if (nextB !== 0)
    return (regs.ix = ix - RECORD_STRIDE, regs.iy = iy - ENTRY_STRIDE, regs.b = nextB, spawnEnemyIntoFreeSlotElseStepSearch(m));
  return void (regs.ix = ix - RECORD_STRIDE, regs.iy = iy - ENTRY_STRIDE, regs.b = nextB);
}
