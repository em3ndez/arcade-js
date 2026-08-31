// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueSoundRun26 } from "./queueSoundRun26.js";
import { queueSoundCommands95And03And11 } from "./queueSoundCommands95And03And11.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { findTableSlotAndPaintStageHeader } from "./findTableSlotAndPaintStageHeader.js";
import {
  WAVE_TEARDOWN_STATE,
  WAVE_EVENT_LATCH,
  PERIODIC_EVENT_TIMER,
  PLAYER_Y,
  GRAB_ACTIVE_FLAG,
  ATTRACT_FIELD_ATTRIB_SRC,
  loc_8083,
} from "./names.js";
/**
 * advanceWaveTeardownByState — shared teardown epilogue, keyed on the teardown-state byte.
 *
 * State 1 dismantles the wave: clear the event latch, reseed the periodic-event timer, run the
 * teardown helper, advance the state, then a running-sum self-check whose masked non-zero
 * result diverts into the stage-header scan. State 2 walks the lead actor's position down two per
 * frame, stepping the sprite-Y deriver while it stays above the limit; once it reaches the limit
 * it queues the completion command and — if the gate byte is clear — raises the completion latch
 * and advances the state. State 0 and states at or above 3 just return.
 *
 * SEATING: BALANCED (plain rets WIRE); the self-check diversion is a tail-jump forwarding the
 * delegatee's result. LIVE-OUT: none of its own.
 */

const BOSS_DESCENT_LIMIT = 0xdb; //   position at/above which the descent completes
const DESCENT_STEP = 2; //            position advances by this per frame
const PERIODIC_TIMER_RESEED = 0x20; // periodic-event timer reload
const CKSUM_LEN = 0x20; //            bytes in the self-check block
const TAMPER_MASK = 0x47; //          masked non-zero sum -> tamper diversion

export function advanceWaveTeardownByState(m) {
  const { mem8 } = m;

  const state = mem8[WAVE_TEARDOWN_STATE];
  if (state === 0) return;

  if (state === 2) {
    mem8[PLAYER_Y] = mem8[PLAYER_Y] + DESCENT_STEP;
    if (mem8[PLAYER_Y] < BOSS_DESCENT_LIMIT) {
      deriveStackedSpriteYs(m); // still descending: refresh the derived sprite Ys
      return;
    }
    queueSoundCommands95And03And11(m); // reached the limit: queue the completion command
    if (mem8[loc_8083] !== 0) return; // already latched
    mem8[GRAB_ACTIVE_FLAG] = mem8[loc_8083] + 1; // gate byte is 0 -> latch = 1
    mem8[WAVE_TEARDOWN_STATE] = mem8[WAVE_TEARDOWN_STATE] + 1; // advance the state
    return;
  }

  if (state >= 3) return;

  // ===== state 1: tear down the wave =====
  mem8[WAVE_EVENT_LATCH] = 0;
  mem8[PERIODIC_EVENT_TIMER] = PERIODIC_TIMER_RESEED;
  queueSoundRun26(m);
  mem8[WAVE_TEARDOWN_STATE] = mem8[WAVE_TEARDOWN_STATE] + 1; // advance the state

  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = u8(sum + mem8[ATTRACT_FIELD_ATTRIB_SRC + i]);
  if ((sum & TAMPER_MASK) !== 0) {
    return findTableSlotAndPaintStageHeader(m, sum & TAMPER_MASK, ATTRACT_FIELD_ATTRIB_SRC + CKSUM_LEN, 0, sum);
  }
}
