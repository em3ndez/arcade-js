// SPDX-License-Identifier: GPL-3.0-only
import {
  STAGE_COUNTDOWN,
  LEAD_ACTOR_STATE,
  ENEMY_ACTOR_TABLE,
  PLAY_STATE_INDEX,
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  WAVE_ARRIVAL_COUNTER,
  SPEED_INDEX,
  PLAYER_AIM_FLAGS,
  loc_8905,
  loc_8906,
} from "./names.js";
/**
 * loc_191c — choose the enemy speed/column value for a new target group.
 *
 * Runs only while the stage countdown and lead-actor state are both idle, and aborts if
 * any of the six enemy records already holds the busy state. Otherwise it bumps the play
 * sub-state, builds a value from the difficulty base plus the round input (halved and
 * added to the wave count when round bit0 is clear), clamps it below the ceiling, stores
 * it as the speed index, and clears the aim flags and two adjacent cells.
 *
 * LIVE-OUT: memory only — no caller reads a register back.
 */

const SLOT_STATE_BUSY = 0x03;
const RECORD_STRIDE = 0x18;
const SCAN_SLOTS = 6;
const SPEED_CEILING = 0x20; // a value at or above this clamps down
const SPEED_MAX = 0x1f;

export function loc_191c(m) {
  const { mem8 } = m;
  if (mem8[STAGE_COUNTDOWN] !== 0) return;
  if (mem8[LEAD_ACTOR_STATE] !== 0) return;

  for (let i = 0; i < SCAN_SLOTS; i++) {
    if (mem8[ENEMY_ACTOR_TABLE + 0x02 + i * RECORD_STRIDE] === SLOT_STATE_BUSY) return;
  }

  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1;

  const round = mem8[ROUND_COUNTER];
  const base = mem8[DIFFICULTY_DSW];
  let value;
  if (round & 0x01) {
    value = (base + round) & 0xff;
  } else {
    value = (base + (round >> 1) + mem8[WAVE_ARRIVAL_COUNTER]) & 0xff;
  }
  if (value >= SPEED_CEILING) value = SPEED_MAX;

  mem8[SPEED_INDEX] = value;
  mem8[PLAYER_AIM_FLAGS] = 0;
  mem8[loc_8905] = 0;
  mem8[loc_8906] = 0;
}
