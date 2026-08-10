// SPDX-License-Identifier: GPL-3.0-only
/** gateTheFreeSlotSearchAndPickItsRun — only two counter values open the gate; past it, the count of
 * enemies still owed picks between two runs of the slot file (the owed run for the round's craft count,
 * else a fixed run of five two records earlier). LIVE-OUT: memory, the two cursors, the counter. */

import { KILLS_REMAINING, ROUND_CRAFT_COUNT } from "./names.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const LAUNCH_TICKS = [0x00, 0x30];

const OWED_RUN = { records: 0xa8b0, entries: 0xaa26 };
const CLEARED_RUN = { records: 0xa890, entries: 0xaa22, slots: 5 };

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
