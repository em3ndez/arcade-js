// SPDX-License-Identifier: GPL-3.0-only
import { spawnActorGroupRecords } from "./spawnActorGroupRecords.js";
import { animateActorGroupGrowShrink } from "./animateActorGroupGrowShrink.js";
import { advanceActorGroupRiseAndCycleTiles } from "./advanceActorGroupRiseAndCycleTiles.js";
/**
 * runActorGroupStateHandler — dispatch the fountain record's per-frame state handler.
 *
 * The record's state byte at IX+2 selects one of three handlers (0/1/2), each run once
 * and returning normally to our caller.
 *
 * LIVE-OUT: memory only — the caller reloads its own pointers after the call.
 */
export function runActorGroupStateHandler(m, rec = m.regs.ix) {
  const { mem8 } = m;
  switch (mem8[rec + 0x02]) {
    case 0:
      return spawnActorGroupRecords(m, rec);
    case 1:
      return animateActorGroupGrowShrink(m, rec);
    case 2:
      return advanceActorGroupRiseAndCycleTiles(m, rec);
  }
}
