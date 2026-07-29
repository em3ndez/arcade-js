// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedDigObjectBlock — seed the dig/target object control block at round start, then hand off
 * to the round/level parameter-seeding chain.  ROM 0x287a.
 *
 * The head of the gameplay round-init tail-jump chain
 * (seedDigObjectBlock → seedZonker → seedEnemyRecords → seedActorSpawnState). It resets the dig-object
 * control block to its start-of-round state: the dig-object state byte to its
 * carving-phase code, the captured target column/row cleared (no target grabbed
 * yet), the active-spawn flag cleared (a fresh spawn is permitted), and a handful of
 * companion counter/scratch bytes of the same block held at fixed start values. It
 * then copies a fixed 24-byte column-position table (a 12-entry ramp of evenly
 * spaced columns, duplicated) from ROM into the block, and hands off to seedZonker,
 * which seeds the round's level/difficulty parameter block. The hand-off is a tail
 * jump: seedZonker's chain returns straight to seedDigObjectBlock's caller, so the delegation IS
 * seedDigObjectBlock's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state.
 *
 * Named by effect: seeds the dig/target object control block at round start before the
 * round/level parameter-seeding chain.
 *
 * Memory-equivalent to the frozen oracle — equivalence-287a.test.js.
 * GATE:     crafted-entry — never dispatched in attract (it runs only from gameplay
 *           round init, which attract never reaches), so it is validated on real
 *           captured attract machine states. Its own body reads nothing from the
 *           entry state (all fixed values plus a fixed ROM-table copy), so any
 *           realistic state is a valid entry: EQUAL over several captured states + a
 *           sentinel-preset entry that makes every write observable + verification the
 *           copied table matches its ROM source, and the teeth twins are caught.
 * LIVE-OUT: memory-only — the seeded control-block bytes, the copied table, and the
 *           whole tail's effects. The round-init caller consumes the seeded memory,
 *           not any register; the tail owns everything after the hand-off.
 * NAMES:    HAZARD_STATE, HAZARD_TYPE, DIG_OBJ_TIMER, DIG_COLLISION_STATE,
 *           DIG_OBJ_SUBTYPE, HAZARD_X, HAZARD_Y, HAZARD_ACTIVE_COUNT, DROP_QUEUE (the table
 *           destination 0x80c3) from ram.js. The companion byte 0x80c2 is still unnamed
 *           and stays hex. The tail is the decompiled seedZonker (ROM 0x2f2f).
 */

import { seedZonker } from "./seedZonker.js";
import {
  DIG_COLLISION_STATE,
  HAZARD_TYPE,
  HAZARD_STATE,
  DIG_OBJ_SUBTYPE,
  DIG_OBJ_TIMER,
  DROP_QUEUE,
  HAZARD_ACTIVE_COUNT,
  HAZARD_X,
  HAZARD_Y,
} from "./ram.js";

export function seedDigObjectBlock(m) {
  const { mem8 } = m;

  // Reset the dig-object control block to its start-of-round state.
  mem8[HAZARD_STATE] = 48; // the carving-phase state code
  mem8[HAZARD_TYPE] = 7; // companion control byte
  mem8[HAZARD_X] = 0; // no captured target column yet
  mem8[HAZARD_Y] = 0; // no captured target row yet
  mem8[DIG_OBJ_TIMER] = 0; // companion counter byte
  mem8[HAZARD_ACTIVE_COUNT] = 0; // idle — a fresh spawn is permitted
  mem8[DIG_COLLISION_STATE] = 0; // companion scratch byte
  mem8[DIG_OBJ_SUBTYPE] = 0; // companion scratch byte

  // Copy the fixed 24-byte column-position table (a 12-entry ramp, duplicated) from
  // ROM into the block.
  for (let i = 0; i < 24; i++) {
    mem8[DROP_QUEUE + i] = mem8[0x2dab + i];
  }
  mem8[0x80c2] = 32; // table-header / count byte

  // Tail hand-off into seedZonker (round/level parameter seeding); its chain returns to
  // our caller, so this is seedDigObjectBlock's exit.
  return seedZonker(m);
}
