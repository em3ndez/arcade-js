// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBarrelSlotIfLive — the barrel walk's per-slot gate: hand a live record to the motion
 * dispatch, or leave a dead slot untouched (the walk advances its cursor either way).
 * ⚠ The test is equality with 1, NOT a bit test: a record holding 2 is skipped like one holding 0.
 * The record pointer rides the return into the index register the motion arms and their frozen
 * probe helpers read it back from; the staging cursor is threaded as the value `cur`.
 */

import { advanceBarrelMotion } from "./advanceBarrelMotion.js";
import { OBJ_ACTIVE } from "./names.js";

export function serviceBarrelSlotIfLive(m, cur, record) {
  const { mem8 } = m;

  if (mem8[record + OBJ_ACTIVE] !== 1) return; // dead slot: nothing to publish, the walk advances

  return (m.regs.ix = record, advanceBarrelMotion(m, cur));
}
