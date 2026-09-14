// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_DEPTH, POKEY2_RANDOM, ENEMY_FIRE_THRESHOLD, ENEMY_FIRE_SELECT } from "./names.js";
import { flipEnemyLaneTowardTarget, flipEnemyLaneRandomSide } from "./flipEnemyLaneTowardTarget.js";

// Per-slot fire gate: fire only when the slot's fire bit is set and a fresh random draw
// clears the threshold; a target flag or the slot parity then picks which step runs.
export function maybeFireEnemyStep(m, x = m.regs.x) {
  const { mem8 } = m;
  if ((mem8[u16(ENEMY_DEPTH + x)] & 0x20) === 0) return;   // fire bit clear
  if (mem8[POKEY2_RANDOM] < mem8[ENEMY_FIRE_THRESHOLD]) return;          // random below threshold
  if ((mem8[ENEMY_FIRE_SELECT] & 0x40) === 0) return flipEnemyLaneRandomSide(m, x);
  if ((x & 1) === 0) return flipEnemyLaneRandomSide(m, x);            // even slot
  return flipEnemyLaneTowardTarget(m, x);                               // odd slot
}
