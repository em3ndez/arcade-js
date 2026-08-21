// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActorArenaAndCounters — actor-state teardown (dispatch state 7).
 *
 * Zeroes the whole actor arena from ACTOR_TABLE, clears the spawn/wave/rope counters, and
 * forces the in-play sub-state to 6.
 *
 * LIVE-OUT: memory only. No register or flag is returned.
 */
import {
  ACTOR_TABLE,
  SPAWN_PHASE_COUNTER,
  WAVE_ARRIVAL_COUNTER,
  ROPE_SEGMENT_COUNT,
  PLAY_STATE_INDEX,
} from "./names.js";

// Total teardown span: the seeding store at ACTOR_TABLE plus a 0x240-byte block copy = 0x241.
const ACTOR_ARENA_LEN = 0x241;

// Sub-state the teardown hands off to.
const STATE_AFTER_TEARDOWN = 6;

export function clearActorArenaAndCounters(m) {
  const { mem8 } = m;

  for (let i = 0; i < ACTOR_ARENA_LEN; i++) mem8[ACTOR_TABLE + i] = 0;

  mem8[SPAWN_PHASE_COUNTER] = 0;
  mem8[WAVE_ARRIVAL_COUNTER] = 0;
  mem8[ROPE_SEGMENT_COUNT] = 0;

  mem8[PLAY_STATE_INDEX] = STATE_AFTER_TEARDOWN;
}
