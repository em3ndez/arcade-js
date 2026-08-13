import { ATTACKER_SPAWN_SLOT_COUNT, ERA_INDEX, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, loc_40ea } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/** sweepEra2PlusObjectBank — enter the per-slot sweep of an object bank: below era 2, or with the bank's slot count
 * zero, do nothing; else seat both cursors and the turn count and run the sweep body. LIVE-OUT: memory. */

const FIRST_SWEPT_ERA = 2;

export function sweepEra2PlusObjectBank(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;

  regs.ix = ERA_OBJECT_RECORD_SLOT0;
  regs.iy = ERA_OBJECT_ENTRY_SLOT0;

  const count = mem8[ATTACKER_SPAWN_SLOT_COUNT];
  if (count === 0) return;

  regs.b = count;
  return m.call(loc_40ea);
}
