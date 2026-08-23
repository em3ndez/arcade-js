// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { adjustSpawnColumn } from "./adjustSpawnColumn.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_57c3 } from "./loc_57c3.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  GAUGE_PHASE_COUNTER,
  SPAWN_COLUMN_BIAS,
  ENEMY_SPAWN_TIMER,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
  SPAWN_FIELD_TABLE,
  SPAWN_FIELD_TABLE_ODD,
  SPAWN_TIMER_TABLE_EVEN,
  SPAWN_TIMER_TABLE_ODD,
} from "./names.js";
/**
 * loc_572b — try to spawn one actor into the current slot.
 *
 * Called once per slot while a caller sweeps the six actor slots. A slot whose low bit is already
 * set is live, so the sweep continues (returns false). An empty slot is initialised: its state,
 * timer and animation fields are seeded, a spawn column is built (clamped difficulty, optional
 * late-gauge bias, an early-stage wave shift, plus round offset, clamped below the arena width),
 * two byte tables give the column's velocity and reload timer, the animation is armed, the active
 * count bumped, and the scan-state head run — then it returns true so the caller aborts its sweep
 * (only one actor spawns per scan).
 *
 * LIVE-OUT: a boolean — true = spawned, the caller must skip the rest of its sweep; false = the
 * slot was live, keep scanning. All other output is in the slot record and shared counters.
 */
export function loc_572b(m, rec = m.regs.ix, col = m.regs.c, eField = m.regs.e) {
  const { mem8 } = m;

  // slot low bit set -> already live; leave it and let the caller keep scanning
  if ((mem8[rec + 0x00] | mem8[rec + 0x01]) & 0x01) return false;

  // seed the fresh slot record
  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x03;
  mem8[rec + 0x04] = eField;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x06] = 0x00;
  mem8[rec + 0x08] = 0x00;
  mem8[rec + 0x07] = 0x01;
  mem8[rec + 0x0b] = 0x00;

  const odd = mem8[ROUND_COUNTER] & 0x01;

  // build the spawn column index
  let column = Math.min(mem8[DIFFICULTY_DSW], 0x03); // clamp difficulty to 3
  if (mem8[GAUGE_PHASE_COUNTER] >= 0x04) column = (mem8[SPAWN_COLUMN_BIAS] + column) & 0xff; // late-gauge bias
  if (!odd) column = adjustSpawnColumn(m, column); // even round: early-stage wave shift
  column = Math.min((mem8[ROUND_COUNTER] + column) & 0xff, 0x1f); // add round, clamp below arena width

  // velocity from the column table, and its negation for the mirrored field
  const velTable = odd ? SPAWN_FIELD_TABLE_ODD : SPAWN_FIELD_TABLE;
  const [vel] = loc_0020(m, velTable, column);
  mem8[rec + 0x09] = vel;
  mem8[rec + 0x0a] = -vel; // mirrored (negated) velocity

  setActorAnimation(m, rec, ANIM_TABLE_3829);

  // reload timer from the column table
  const timerTable = odd ? SPAWN_TIMER_TABLE_ODD : SPAWN_TIMER_TABLE_EVEN;
  const [timer] = loc_0020(m, timerTable, column);
  mem8[ENEMY_SPAWN_TIMER] = timer;

  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;
  loc_57c3(m, col); // run the scan-state head for the new actor
  return true; // spawned -> caller aborts its sweep
}
