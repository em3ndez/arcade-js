// SPDX-License-Identifier: GPL-3.0-only
/** gateTheFreeSlotSearchAndPickItsRun — decide whether this tick is a launch tick and, if it is, hand the spawner the run of
 * slots to search. The caller points at a counter cell and only two of its values open the gate; on
 * every other value the entry ends with nothing staged. Past the gate the count of enemies still
 * owed picks between two runs of the one slot file: while any are owed the run begins at the later
 * record and is as long as the round's craft count asks, and once none are owed a fixed run of five
 * begins two records earlier. A run's two cursors index TWO PARALLEL TABLES at the same slot — a
 * sixteen-byte record in one, a two-byte sprite entry in the other. Control then leaves for the spawner and does not come
 * back. LIVE-OUT: memory, and the run staged in the two cursors and the slot counter. */

import { KILLS_REMAINING } from "./names.js";

const LAUNCH_TICKS = [0x00, 0x30];
const ROUND_CRAFT_COUNT = 0xacc1;
const SLOT_BODY = 0x37d6;

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
  return m.call(SLOT_BODY);
}
