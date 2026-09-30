// SPDX-License-Identifier: GPL-3.0-only
/** loc_3793 — start the free-slot search on the highest of five consecutive object slots, handing
 * the body that fills the first free one a count of five and the two cursors; all three are
 * constants. LIVE-OUT: memory. */

import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";
import { CRAFT_ENTRY_SLOT4, CRAFT_RECORD_SLOT4 } from "./names.js";

const SLOTS_IN_THE_PASS = 5;

export function loc_3793(m) {
  return spawnEnemyIntoFreeSlotElseStepSearch(m, CRAFT_RECORD_SLOT4, CRAFT_ENTRY_SLOT4, SLOTS_IN_THE_PASS);
}
