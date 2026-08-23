// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import {
  SHARED_PHASE_COUNTDOWN,
  ENEMY_ACTOR_TABLE,
  OBJECT_STATE_RECORD_BASE,
  ATTRACT_SUBSTATE,
  SPAWN_RING_COUNTER,
} from "./names.js";

const STATE_FIELD = 0x02; //  state-byte offset within a record
const STRIDE = 0x18; //       record stride
const STATE_SEEDED = 0x02; // state byte seeded into the enemy records
const SEED_COUNT = 0x08; //   enemy records seeded on expiry
const CLEAR_COUNT = 0x06; //  object-state records cleared on expiry
const SUBSTATE_ON_EXPIRY = 0x08; // attract sub-state set on expiry

/**
 * loc_7675 — animation-tick state 1 (dissolved caller-skip).
 *
 * Steps the entry's animation, then counts the shared phase countdown down: while it is non-zero it
 * just decrements it and keeps the walk going. When it reaches zero it re-seeds the wave — the state
 * byte of 8 enemy records set to 2, the state byte of 6 object-state records cleared, the spawn ring
 * counter cleared, the attract sub-state set to 8 — and aborts the walk.
 *
 * LIVE-OUT: none in registers — the caller reads back only the control-flow boolean (true = keep
 * walking, false = abort). Memory: the stepped animation, the shared phase countdown, the seeded
 * enemy state bytes, the cleared object-state bytes, the spawn ring counter, and the attract sub-state.
 */
export function loc_7675(m, ix = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, ix); // step this entry's animation

  if (mem8[SHARED_PHASE_COUNTDOWN] !== 0) {
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] - 1; // still counting -> keep walking
    return true;
  }

  let rec = ENEMY_ACTOR_TABLE + STATE_FIELD;
  for (let n = 0; n < SEED_COUNT; n++) {
    mem8[rec] = STATE_SEEDED;
    rec = u16(rec + STRIDE);
  }
  rec = OBJECT_STATE_RECORD_BASE + STATE_FIELD;
  for (let n = 0; n < CLEAR_COUNT; n++) {
    mem8[rec] = 0x00;
    rec = u16(rec + STRIDE);
  }
  mem8[SPAWN_RING_COUNTER] = 0x00;
  mem8[ATTRACT_SUBSTATE] = SUBSTATE_ON_EXPIRY;
  return false; // countdown expired -> abort the walk (caller-skip)
}
