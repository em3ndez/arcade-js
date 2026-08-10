// SPDX-License-Identifier: GPL-3.0-only
/** loc_3793 — seat the count and the two cursors on the highest of five consecutive object slots,
 * then transfer into the body that fills the first free one; all three are constants. LIVE-OUT: the count, the two cursors. */

import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";
import { CRAFT_ENTRY_SLOT4, CRAFT_RECORD_SLOT4 } from "./names.js";

const SLOTS_IN_THE_PASS = 5;

export function loc_3793(m) {
  const { regs } = m;
  regs.b = SLOTS_IN_THE_PASS;
  regs.ix = CRAFT_RECORD_SLOT4;
  regs.iy = CRAFT_ENTRY_SLOT4;
  return spawnEnemyIntoFreeSlotElseStepSearch(m);
}
