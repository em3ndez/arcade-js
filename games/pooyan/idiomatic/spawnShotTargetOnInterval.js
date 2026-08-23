// SPDX-License-Identifier: GPL-3.0-only
import { loc_0020 } from "./loc_0020.js";
import { loc_5544 } from "./loc_5544.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  SPAWN_INTERVAL_COUNTDOWN,
  SPAWN_INTERVAL_TABLE_55FF,
  SPAWN_SEQUENCE_INDEX_8D13,
  SPAWN_OBJECT_TABLE,
} from "./names.js";
/**
 * spawnShotTargetOnInterval — spawn scheduler B, falls through into the spawn loop.
 *
 * Gate: round >= 2 skips the difficulty check; round < 2 requires difficulty >= 2 or returns. Then
 * it ticks the per-type spawn countdown and proceeds only when it reaches zero, reloading it from
 * the interval table (indexed by the low nibble of the spawn cursor) and advancing that cursor.
 * Finally it seats the spawn-loop inputs (the spawn-object table, stride 0x18, one block) and delegates.
 *
 * LIVE-OUT: none — the spawn loop declares no register live-out and the callers read only memory back.
 */

const SPAWN_STRIDE = 0x18; //  block stride handed to the spawn loop
const SPAWN_COUNT = 0x01; //   one block per call
const MIN_ROUND = 0x02; //     round >= 2 skips the difficulty gate
const MIN_DIFFICULTY = 0x02; // round < 2 needs difficulty >= 2
const INDEX_MASK = 0x0f;

export function spawnShotTargetOnInterval(m) {
  const { mem8 } = m;

  if (mem8[ROUND_COUNTER] < MIN_ROUND && mem8[DIFFICULTY_DSW] < MIN_DIFFICULTY) return;

  const countdown = (mem8[SPAWN_INTERVAL_COUNTDOWN] - 1) & 0xff;
  mem8[SPAWN_INTERVAL_COUNTDOWN] = countdown;
  if (countdown !== 0) return; // per-type countdown still running

  const idx = mem8[SPAWN_SEQUENCE_INDEX_8D13] & INDEX_MASK;
  const [reload] = loc_0020(m, SPAWN_INTERVAL_TABLE_55FF, idx); // table lookup
  mem8[SPAWN_INTERVAL_COUNTDOWN] = reload; // reload the countdown
  mem8[SPAWN_SEQUENCE_INDEX_8D13] = mem8[SPAWN_SEQUENCE_INDEX_8D13] + 1; // advance index (write truncates)

  return loc_5544(m, SPAWN_OBJECT_TABLE, SPAWN_STRIDE, SPAWN_COUNT); // fall through into the spawn loop
}
