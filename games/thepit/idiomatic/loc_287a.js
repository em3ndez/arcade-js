// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_287a — seed the dig/target object control block at round start, then hand off
 * to the round/level parameter-seeding chain.  ROM 0x287a.
 *
 * The head of the gameplay round-init tail-jump chain
 * (loc_287a → loc_2f2f → seedObjectRecords → seedActorSpawnState). It resets the dig-object
 * control block to its start-of-round state: the dig-object state byte to its
 * carving-phase code, the captured target column/row cleared (no target grabbed
 * yet), the active-spawn flag cleared (a fresh spawn is permitted), and a handful of
 * companion counter/scratch bytes of the same block held at fixed start values. It
 * then copies a fixed 24-byte column-position table (a 12-entry ramp of evenly
 * spaced columns, duplicated) from ROM into the block, and hands off to loc_2f2f,
 * which seeds the round's level/difficulty parameter block. The hand-off is a tail
 * jump: loc_2f2f's chain returns straight to loc_287a's caller, so the delegation IS
 * loc_287a's exit.
 *
 * Every write lands on a distinct work-RAM byte, so their order does not affect the
 * resulting state.
 *
 * Name kept as loc_287a: like its successors loc_2f2f/seedObjectRecords, roughly half of the
 * block it seeds (the companion bytes and the copied table) sits at addresses whose
 * subsystem role is not yet confirmed, so the routine's overall role is a best-effort
 * reading — below the bar to promote to an English name.
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
 * NAMES:    DIG_OBJ_STATE, DIG_OBJ_ATTR, DIG_OBJ_TIMER, DIG_OBJ_ARM_STATE,
 *           DIG_OBJ_SUBTYPE, TARGET_X, TARGET_Y, SPAWN_STATE from ram.js. The companion
 *           byte 0x80c2 and the table destination (0x80c3) are still unnamed and stay
 *           hex. The tail is the decompiled loc_2f2f (ROM 0x2f2f).
 */

import { loc_2f2f } from "./loc_2f2f.js";
import {
  DIG_OBJ_ARM_STATE,
  DIG_OBJ_ATTR,
  DIG_OBJ_STATE,
  DIG_OBJ_SUBTYPE,
  DIG_OBJ_TIMER,
  SPAWN_STATE,
  TARGET_X,
  TARGET_Y,
} from "./ram.js";

export function loc_287a(m) {
  const { mem8 } = m;

  // Reset the dig-object control block to its start-of-round state.
  mem8[DIG_OBJ_STATE] = 48; // the carving-phase state code
  mem8[DIG_OBJ_ATTR] = 7; // companion control byte
  mem8[TARGET_X] = 0; // no captured target column yet
  mem8[TARGET_Y] = 0; // no captured target row yet
  mem8[DIG_OBJ_TIMER] = 0; // companion counter byte
  mem8[SPAWN_STATE] = 0; // idle — a fresh spawn is permitted
  mem8[DIG_OBJ_ARM_STATE] = 0; // companion scratch byte
  mem8[DIG_OBJ_SUBTYPE] = 0; // companion scratch byte

  // Copy the fixed 24-byte column-position table (a 12-entry ramp, duplicated) from
  // ROM into the block.
  for (let i = 0; i < 24; i++) {
    mem8[0x80c3 + i] = mem8[0x2dab + i];
  }
  mem8[0x80c2] = 32; // table-header / count byte

  // Tail hand-off into loc_2f2f (round/level parameter seeding); its chain returns to
  // our caller, so this is loc_287a's exit.
  return loc_2f2f(m);
}
