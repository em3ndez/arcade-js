// SPDX-License-Identifier: GPL-3.0-only
import { loc_119a } from "./loc_119a.js";
import {
  ENEMY_SPAWN_TIMER,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

/**
 * loc_1171 — spawn-cadence tick for the enemy actor pool.
 *
 * While the spawn timer is nonzero it just counts down. At zero it gates the sweep: it does nothing
 * unless the stage countdown exceeds the active-enemy count and fewer than six enemies are active.
 * When it does sweep, it walks the six enemy records and initialises the first free one, then stops.
 *
 * The per-record initialiser returns true for a record already active (keep scanning) and false when
 * it has just seeded a free record; false ends the sweep and returns. LIVE-OUT: none — the frame
 * dispatcher that invokes this reads no register back.
 */

const SPAWN_SEED = 0x1d; // the +4 position field stamped into each initialised record
const MAX_ACTIVE = 0x06; // suppress spawning once this many enemies are already active
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 6;

export function loc_1171(m) {
  const { mem8 } = m;

  if (mem8[ENEMY_SPAWN_TIMER] !== 0) {
    mem8[ENEMY_SPAWN_TIMER] = mem8[ENEMY_SPAWN_TIMER] - 1;
    return;
  }

  const active = mem8[ACTIVE_ENEMY_COUNT];
  if (mem8[STAGE_COUNTDOWN] <= active) return; // stage countdown not ahead of the active count
  if (active >= MAX_ACTIVE) return; // pool already full

  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    if (!loc_119a(m, rec, SPAWN_SEED)) return; // seeded a free record -> sweep done
    rec = rec + RECORD_STRIDE;
  }
}
