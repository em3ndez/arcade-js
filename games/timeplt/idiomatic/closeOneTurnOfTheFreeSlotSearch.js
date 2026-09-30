// SPDX-License-Identifier: GPL-3.0-only
/** closeOneTurnOfTheFreeSlotSearch — step both cursors BACKWARD one whole element and strike one off
 * the count; while any remain, hand the stepped cursors and the count back to the body that works one
 * slot, else just return. The cursors and the count travel as arguments from turn to turn and are
 * dead once the search ends. LIVE-OUT: memory. */

import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";
import { u8, u16 } from "../../../core/int.js";

const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

export function closeOneTurnOfTheFreeSlotSearch(m, ix = m.regs.ix, iy = m.regs.iy, b = m.regs.b) {
  const nextB = u8(b - 1); // a count of zero wraps, so it runs 256 turns
  if (nextB !== 0) return spawnEnemyIntoFreeSlotElseStepSearch(m, u16(ix - RECORD_STRIDE), u16(iy - ENTRY_STRIDE), nextB);
}
