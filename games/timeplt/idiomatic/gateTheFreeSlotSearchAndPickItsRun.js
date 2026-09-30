// SPDX-License-Identifier: GPL-3.0-only
/** gateTheFreeSlotSearchAndPickItsRun — only two counter values open the gate; past it, the count of
 * enemies still owed picks between two runs of the slot file (the owed run for the round's craft count,
 * else a fixed run of five two records earlier), and hands the run's two cursors and its count to the
 * search. LIVE-OUT: memory. */

import { CRAFT_ENTRY_SLOT4, CRAFT_ENTRY_SLOT6, CRAFT_RECORD_SLOT4, CRAFT_RECORD_SLOT6, KILLS_REMAINING, ROUND_CRAFT_COUNT } from "./names.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const LAUNCH_TICKS = [0x00, 0x30];

const OWED_RUN = { records: CRAFT_RECORD_SLOT6, entries: CRAFT_ENTRY_SLOT6 };
const CLEARED_RUN = { records: CRAFT_RECORD_SLOT4, entries: CRAFT_ENTRY_SLOT4, slots: 5 };

export function gateTheFreeSlotSearchAndPickItsRun(m, hl = m.regs.hl) {
  const { mem8 } = m;
  if (!LAUNCH_TICKS.includes(mem8[hl])) return;

  const cleared = mem8[KILLS_REMAINING] === 0;
  const run = cleared ? CLEARED_RUN : OWED_RUN;
  const slotCount = cleared ? CLEARED_RUN.slots : mem8[ROUND_CRAFT_COUNT];
  return spawnEnemyIntoFreeSlotElseStepSearch(m, run.records, run.entries, slotCount);
}
