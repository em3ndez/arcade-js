// SPDX-License-Identifier: GPL-3.0-only
import { testRecordOverlapRetireOrFlagHit } from "./testRecordOverlapRetireOrFlagHit.js";
import {
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  ACTIVE_OBJECT_TYPE,
  ENEMY_ACTOR_TABLE,
  ENEMY_SCAN_BOX_TABLE,
} from "./names.js";
/**
 * loc_5f83 — arm and enter the enemy-record overlap scan for one interrupt-parity slot.
 *
 * Picks the slot's presence block by the parity selector, then gates on that block's lead byte: a
 * zero block is inert and completes normally. A live block latches its kind as the active hit type
 * and enters the six-record overlap scan, tagging it with the kind (the tighter-threshold
 * selector) and the caller's target box.
 *
 * SEATING: dissolved to a boolean — true = the slot completed normally (an inert block, or a scan
 * with no hit); false = a hit inside the scan skip-returns past the caller's loop. LIVE-OUT: the
 * boolean plus memory (the latched type); no register is read back.
 */
const SCAN_RECORD_COUNT = 6;

export function loc_5f83(m, slot = m.regs.i, target = m.regs.iy) {
  const { mem8 } = m;
  const type = mem8[slot === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1];
  if (type === 0) return true; // inert block -> normal completion
  mem8[ACTIVE_OBJECT_TYPE] = type;
  return testRecordOverlapRetireOrFlagHit(m, ENEMY_ACTOR_TABLE, ENEMY_SCAN_BOX_TABLE, SCAN_RECORD_COUNT, type, target);
}
