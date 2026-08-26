// SPDX-License-Identifier: GPL-3.0-only
import { loc_5871 } from "./loc_5871.js";
import { loc_572b } from "./loc_572b.js";
import {
  ENEMY_SPAWN_TIMER,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPEED_INDEX,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

const SLOT_COUNT = 0x06;
const SLOT_STRIDE = 0x18;
const SPAWN_E_FIELD = 0x1d;

/**
 * loc_56e8 — enemy-spawn tick.
 *
 * While the spawn timer is nonzero, decrement it and return. At zero, on an even round hand the
 * spawn decision to the spawn gate; otherwise gate on the stage countdown vs the active enemy
 * count — bailing when they are equal, when the countdown is below the count, or when the count
 * has reached the difficulty threshold (SPEED_INDEX<3 -> SPEED_INDEX+4, else 6). If the gate
 * passes, sweep the six actor slots and spawn at most one per tick (a spawn aborts the sweep).
 *
 * LIVE-OUT: none — a void per-frame driver; the caller rets straight after and reads no register
 * back. Output is in RAM (the timer, the seeded slot record, the shared spawn counters).
 */
export function loc_56e8(m) {
  const { mem8 } = m;

  const timer = mem8[ENEMY_SPAWN_TIMER];
  if (timer !== 0) {
    mem8[ENEMY_SPAWN_TIMER] = timer - 1; // nonzero -> no underflow; mem8 masks the byte
    return;
  }

  const round = mem8[ROUND_COUNTER];
  if (!(round & 0x01)) return loc_5871(m, round); // even round -> spawn gate (tail; seed = round)

  const stageCountdown = mem8[STAGE_COUNTDOWN];
  const active = mem8[ACTIVE_ENEMY_COUNT];
  if (stageCountdown === active) return;
  if (stageCountdown < active) return;
  const col = stageCountdown - active;

  const speed = mem8[SPEED_INDEX];
  const threshold = speed < 0x03 ? speed + 0x04 : 0x06;
  if (active >= threshold) return;

  let rec = ENEMY_ACTOR_TABLE;
  for (let n = SLOT_COUNT; n > 0; n--) {
    if (loc_572b(m, rec, col, SPAWN_E_FIELD)) return; // spawned -> abort the sweep
    rec += SLOT_STRIDE;
  }
}
