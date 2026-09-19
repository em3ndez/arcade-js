// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedDigObjectBlock — seed the dig/target object control block at round start, then hand off to
 * the round/level parameter-seeding chain.
 *
 * The head of the gameplay round-init tail-jump chain. It resets the dig-object control block to
 * its start-of-round state (carving-phase state code, captured target cleared, active-spawn flag
 * cleared, companion counters at fixed start values), copies a fixed 24-byte column-position
 * table (a 12-entry ramp, duplicated) into the block, then tail-hands to the next seeder, whose
 * chain returns straight to this routine's caller — so the delegation is this routine's exit.
 */

import { seedChamberCreature } from "./seedChamberCreature.js";
import {
  DIG_COLLISION_STATE,
  DIG_OBJECT_DROP_QUEUE_SEED_TABLE,
  DIG_OBJ_SUBTYPE,
  DIG_OBJ_TIMER,
  DIG_OBJ_TIMER_RELOAD,
  DROP_QUEUE,
  HAZARD_ACTIVE_COUNT,
  HAZARD_STATE,
  HAZARD_TYPE,
  HAZARD_X,
  HAZARD_Y,
} from "./names.js";

export function seedDigObjectBlock(m) {
  const { mem8 } = m;

  // Reset the dig-object control block to its start-of-round state.
  mem8[HAZARD_STATE] = 48; // the carving-phase state code
  mem8[HAZARD_TYPE] = 7; // companion control byte
  mem8[HAZARD_X] = 0; // no captured target column yet
  mem8[HAZARD_Y] = 0; // no captured target row yet
  mem8[DIG_OBJ_TIMER] = 0;
  mem8[HAZARD_ACTIVE_COUNT] = 0; // idle — a fresh spawn is permitted
  mem8[DIG_COLLISION_STATE] = 0; // companion scratch byte
  mem8[DIG_OBJ_SUBTYPE] = 0;

  // Copy the fixed 24-byte column-position table (a 12-entry ramp, duplicated) into the block.
  for (let i = 0; i < 24; i++) {
    mem8[DROP_QUEUE + i] = mem8[DIG_OBJECT_DROP_QUEUE_SEED_TABLE + i];
  }
  mem8[DIG_OBJ_TIMER_RELOAD] = 32; // table-header / count byte

  // Tail hand-off into the parameter-seeding chain; its return carries back to our caller.
  return seedChamberCreature(m);
}
