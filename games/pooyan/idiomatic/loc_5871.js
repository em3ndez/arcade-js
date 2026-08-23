// SPDX-License-Identifier: GPL-3.0-only
import {
  SPEED_INDEX,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPAWN_ACTIVE_FLAG,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
import { loc_588e } from "./loc_588e.js";

const ACTIVE_CAP = 0x06; // most records that may be active at once
const INIT_RECORD_COUNT = 0x06; // records the init loop seeds on a launch

/**
 * loc_5871 — actor-spawn gate.
 *
 * Latches the entry value into the speed index, then launches a new actor only when the active count
 * is strictly below the stage threshold AND below the cap. An active count that has reached the
 * threshold, dropped below it (borrow), or filled the roster backs out untouched. On a launch it
 * raises the spawn-active flag and runs the init loop over the record block.
 *
 * LIVE-OUT: none — a void spawn driver in a void-driver chain; the caller rets straight after and
 * reads no register back. The value latched into the speed index is bridged from the entry register.
 */
export function loc_5871(m, speedSeed = m.regs.a) {
  const { mem8 } = m;
  mem8[SPEED_INDEX] = speedSeed;

  const active = mem8[ACTIVE_ENEMY_COUNT];
  if (mem8[STAGE_COUNTDOWN] <= active) return; // at or below threshold
  if (active >= ACTIVE_CAP) return; // roster already full

  mem8[SPAWN_ACTIVE_FLAG] = 0x01;
  loc_588e(m, ENEMY_ACTOR_TABLE, INIT_RECORD_COUNT);
}
