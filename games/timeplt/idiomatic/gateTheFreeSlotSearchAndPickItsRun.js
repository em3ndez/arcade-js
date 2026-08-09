// SPDX-License-Identifier: GPL-3.0-only
/** gateTheFreeSlotSearchAndPickItsRun — decide whether this tick launches and, if so, hand the body
 * the run of slots to search: only two counter values open the gate. Past it the count of enemies
 * still owed picks between two runs of the one slot file — while owed, start at the later record for
 * the round's craft count, else a fixed run of five two records earlier. LIVE-OUT: memory, the two cursors, the counter. */

import { KILLS_REMAINING } from "./names.js";
import { spawnEnemyIntoFreeSlotElseStepSearch } from "./spawnEnemyIntoFreeSlotElseStepSearch.js";

const LAUNCH_TICKS = [0x00, 0x30];
const ROUND_CRAFT_COUNT = 0xacc1;

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
