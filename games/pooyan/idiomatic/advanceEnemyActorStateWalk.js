// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_7638 } from "./loc_7638.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";

const STRIDE = 0x18; // enemy-actor record stride

/**
 * advanceEnemyActorStateWalk — shared per-frame animation-tick walk.
 *
 * Ticks `count` records of the enemy-actor array in order, stride 0x18, from its base. A tick may
 * abort the whole walk (returns false); this loop propagates that as an early return, leaving the
 * remaining records untouched.
 *
 * LIVE-OUT: none in registers — the caller reads nothing back; memory holds whatever the ticks wrote.
 * `count` is the record count, bridged from the entry register.
 */
export function advanceEnemyActorStateWalk(m, count = m.regs.b) {
  let ix = ENEMY_ACTOR_TABLE;
  for (let n = count; n > 0; n--) {
    if (!loc_7638(m, ix)) return; // a tick aborted the walk
    ix = u16(ix + STRIDE);
  }
}
