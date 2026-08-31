// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER, SPAWN_STEP_TIMER, STATE_TIMER_RELOAD_TABLE } from "./names.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { restartActorAnimIfFlagBit0Set } from "./restartActorAnimIfFlagBit0Set.js";
import { dispatchSpawnScheduleUnlessActorFlagged } from "./dispatchSpawnScheduleUnlessActorFlagged.js";
import { spawnChildActorIntoFreeSpriteSlot } from "./spawnChildActorIntoFreeSpriteSlot.js";
/**
 * dispatchActorSpawnBySubStateAndPaceCadence — state dispatch on the actor's sub-state byte (rec+6).
 *
 * Below 7 the record is still spawning: tail to the spawn-step guard. At or above 0x14 it is fully
 * grown: tail to the field-compare dispatch. In between it paces the spawn cadence with a shared
 * timer: while the timer runs it just decrements and returns; when the timer is spent it reloads it
 * from the per-round table (indexed by the round counter) and spawns a child — but only once the
 * count is below 0x80, otherwise it returns untouched.
 *
 * LIVE-OUT: memory only.
 */
export function dispatchActorSpawnBySubStateAndPaceCadence(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  const state = mem8[rec + 0x06];
  if (state < 0x07) return restartActorAnimIfFlagBit0Set(m, rec);
  if (state >= 0x14) return dispatchSpawnScheduleUnlessActorFlagged(m, rec);

  if (mem8[SPAWN_STEP_TIMER] === 0) {
    if (count >= 0x80) return; // count exhausted
    const idx = mem8[ROUND_COUNTER] & 0x07;
    const [reload] = fetchByteFromTableIndex(m, STATE_TIMER_RELOAD_TABLE, idx);
    mem8[SPAWN_STEP_TIMER] = reload;
    return spawnChildActorIntoFreeSpriteSlot(m, rec);
  }

  mem8[SPAWN_STEP_TIMER] = mem8[SPAWN_STEP_TIMER] - 1;
}
