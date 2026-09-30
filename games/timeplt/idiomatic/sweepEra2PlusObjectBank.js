import { ATTACKER_SPAWN_SLOT_COUNT, ERA_INDEX, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0 } from "./names.js";
import { serviceSlotByMarkerThenCloseSweepTurn } from "./serviceSlotByMarkerThenCloseSweepTurn.js";
// SPDX-License-Identifier: GPL-3.0-only
/** sweepEra2PlusObjectBank — enter the per-slot sweep of an object bank: below the first swept era, or with the bank's
 * slot count zero, do nothing; else run the sweep body from the bank's first record and sprite
 * entry for that many turns. LIVE-OUT: memory. */

const FIRST_SWEPT_ERA = 2;

export function sweepEra2PlusObjectBank(m) {
  const { mem8 } = m;

  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;

  const count = mem8[ATTACKER_SPAWN_SLOT_COUNT];
  if (count === 0) return;

  return serviceSlotByMarkerThenCloseSweepTurn(m, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0, count);
}
