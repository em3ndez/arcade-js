// SPDX-License-Identifier: GPL-3.0-only
/** gateTheFreeSlotSearchAndPickItsRun — only two counter values open the gate; past it, the count of
 * enemies still owed picks between two runs of the slot file (the owed run for the round's craft count,
 * else a fixed run of five two records earlier). LIVE-OUT: memory, the two cursors, the counter. */

import { CRAFT_ENTRY_SLOT4, CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT4, CRAFT_RECORD_SLOT6, KILLS_REMAINING, ROUND_CRAFT_COUNT } from "./names.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const LAUNCH_TICKS = [0x00, 0x30];

const OWED_RUN = { records: CRAFT_RECORD_SLOT6, entries: CRAFT_ENTRY_SLOT6 };
const CLEARED_RUN = { records: CRAFT_RECORD_SLOT4, entries: CRAFT_ENTRY_SLOT4, slots: 5 };

export function gateTheFreeSlotSearchAndPickItsRun(m) {
  const { regs, mem8 } = m;
  if (!LAUNCH_TICKS.includes(mem8[regs.hl])) return;

  const cleared = mem8[KILLS_REMAINING] === 0;
  const run = cleared ? CLEARED_RUN : OWED_RUN;
  regs.b = cleared ? CLEARED_RUN.slots : mem8[ROUND_CRAFT_COUNT];
  regs.ix = run.records;
  regs.iy = run.entries;
  return spawnEnemyIntoFreeSlotElseStepSearch(m);
}
