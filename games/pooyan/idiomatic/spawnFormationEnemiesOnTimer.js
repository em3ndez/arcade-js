// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { seedFirstFreeSlotForTimedSpawnWithTamperCheck } from "./seedFirstFreeSlotForTimedSpawnWithTamperCheck.js";
import {
  SPAWN_RELOAD_TIMER,
  SPAWN_TIMER_RELOAD_TABLE,
  SPAWN_SEQUENCE_INDEX_8D14,
  FORMATION_SPAWN_TABLE,
  ROUND_COUNTER,
  DIFFICULTY_DSW,
} from "./names.js";
/**
 * spawnFormationEnemiesOnTimer — frame-timer gated formation spawner.
 *
 * Ticks the reload timer and returns while it is still running. On expiry it reloads the timer from
 * SPAWN_TIMER_RELOAD_TABLE[cursor & 0x0f], advances the spawn cursor, and picks a spawn count: 2 once
 * the round reaches 4; otherwise 0 (return) when the difficulty byte is 0, 1 below 4, else 2. It then
 * tails the scan/seed loop over the FORMATION_SPAWN_TABLE blocks with that count.
 *
 * LIVE-OUT: none — a void spawner; all effect is in the timer, the cursor, and the seeded blocks.
 */
const BLOCK_STRIDE = 0x18; // actor-record stride the scan/seed tail walks

export function spawnFormationEnemiesOnTimer(m) {
  const { mem8 } = m;

  mem8[SPAWN_RELOAD_TIMER] = mem8[SPAWN_RELOAD_TIMER] - 1; // mem8 write truncates to 8 bits
  if (mem8[SPAWN_RELOAD_TIMER] !== 0) return; // timer still running

  const idx = mem8[SPAWN_SEQUENCE_INDEX_8D14] & 0x0f;
  const [reload] = fetchByteFromTableIndex(m, SPAWN_TIMER_RELOAD_TABLE, idx); // rst-20 table fetch
  mem8[SPAWN_RELOAD_TIMER] = reload;
  mem8[SPAWN_SEQUENCE_INDEX_8D14] = mem8[SPAWN_SEQUENCE_INDEX_8D14] + 1;

  let count;
  if (mem8[ROUND_COUNTER] >= 0x04) {
    count = 0x02;
  } else {
    const difficulty = mem8[DIFFICULTY_DSW]; // treats the difficulty byte as the active-wave count
    if (difficulty === 0) return; // no active wave
    count = difficulty < 0x04 ? 0x01 : 0x02;
  }
  return seedFirstFreeSlotForTimedSpawnWithTamperCheck(m, FORMATION_SPAWN_TABLE, BLOCK_STRIDE, count); // tail: scan/seed the blocks
}
