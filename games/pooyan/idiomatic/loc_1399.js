// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER, SPAWN_STEP_TIMER, STATE_TIMER_RELOAD_TABLE } from "./names.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_1389 } from "./loc_1389.js";
import { loc_1391 } from "./loc_1391.js";
import { loc_13bc } from "./loc_13bc.js";
/**
 * loc_1399 — state dispatch on the actor's sub-state byte (rec+6).
 *
 * Below 7 the record is still spawning: tail to the spawn-step guard. At or above 0x14 it is fully
 * grown: tail to the field-compare dispatch. In between it paces the spawn cadence with a shared
 * timer: while the timer runs it just decrements and returns; when the timer is spent it reloads it
 * from the per-round table (indexed by the round counter) and spawns a child — but only once the
 * count is below 0x80, otherwise it returns untouched.
 *
 * LIVE-OUT: memory only.
 */
export function loc_1399(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  const state = mem8[rec + 0x06];
  if (state < 0x07) return loc_1389(m, rec);
  if (state >= 0x14) return loc_1391(m, rec);

  if (mem8[SPAWN_STEP_TIMER] === 0) {
    if (count >= 0x80) return; // count exhausted
    const idx = mem8[ROUND_COUNTER] & 0x07;
    const [reload] = loc_0020(m, STATE_TIMER_RELOAD_TABLE, idx);
    mem8[SPAWN_STEP_TIMER] = reload;
    return loc_13bc(m, rec);
  }

  mem8[SPAWN_STEP_TIMER] = mem8[SPAWN_STEP_TIMER] - 1;
}
