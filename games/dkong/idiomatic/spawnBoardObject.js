// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnBoardObject — on the spawn cadence, claim the first free object slot and seed a new
 * board object; always tick the cadence timer down. While SPAWN_TIMER is nonzero nothing
 * spawns; on the beat with a slot free, claim it, reload the cooldown and tick once (lands at
 * reload-minus-one); on the beat with every slot busy, retry next pass without reloading.
 *
 * LIVE-OUT: memory-only — SPAWN_TIMER, plus the claimed record's active flag, X, Y and state
 * byte on the spawning path.
 */

import { SPAWN_TIMER, OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";
import { decrementByteAt } from "./decrementByteAt.js";

const SLOT_COUNT = 6;
const SLOT_STRIDE = 0x10;
const ACTIVE_BIT = 0x01;      // bit0 of the active flag: 1 = slot in use

const SPAWN_X = 0x37;
const SPAWN_Y = 0xf8;
const SPAWN_STATE = 0x08;
const COOLDOWN_RELOAD = 0x34;

export function spawnBoardObject(m) {
  const { mem8 } = m;

  if (mem8[SPAWN_TIMER] !== 0) {
    decrementByteAt(m, SPAWN_TIMER);
    return;
  }

  let slot = OBJ_ARRAY_66;
  let free = false;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem8[slot + OBJ_ACTIVE] & ACTIVE_BIT) === 0) { free = true; break; }
    slot += SLOT_STRIDE;
  }

  // Every slot busy: retry next pass without reloading or ticking the timer.
  if (!free) return;

  mem8[slot + OBJ_ACTIVE] = ACTIVE_BIT;
  mem8[slot + OBJ_X] = SPAWN_X;
  mem8[slot + OBJ_Y] = SPAWN_Y;
  mem8[slot + OBJ_STATE] = SPAWN_STATE;

  mem8[SPAWN_TIMER] = COOLDOWN_RELOAD;
  decrementByteAt(m, SPAWN_TIMER);
}
