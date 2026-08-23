// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  SUBPHASE_TICK,
  FORMATION_SLOT_TABLE,
  PLAY_MODE_LATCH,
  ROUND_IN_PROGRESS,
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  PLAY_STATE_INDEX,
  WAVE_ARRIVAL_COUNTER,
  LEAD_ACTOR_FRAME_DELAY,
  TWOTILE_ANIM_HOLD,
  ROPE_DRAW_STEP_TIMER,
} from "./names.js";
import { loc_4381 } from "./loc_4381.js";
import { loc_1ead } from "./loc_1ead.js";
import { loc_540d } from "./loc_540d.js";
import { paintPhaseGauge } from "./paintPhaseGauge.js";
import { loc_4a0b } from "./loc_4a0b.js";
import { loc_02ef } from "./loc_02ef.js";

/**
 * loc_175d — play sub-state idx2 handler.
 *
 * Runs the display-list interpreter, then advances two guards: SUBPHASE_TICK wraps every 0x1c calls
 * (returns until then), and on that wrap a one-shot at FORMATION_SLOT_TABLE (multiplexed here as a
 * two-hit gate) returns the first time and clears + proceeds the second. Past both it picks an
 * action from PLAY_MODE_LATCH / ROUND_IN_PROGRESS / GAME_ACTIVE_FLAG / ROUND_COUNTER: either arm
 * sub-state 0x0d, or run the level-start batch and force sub-state 3.
 *
 * LIVE-OUT: none — a void dispatched handler; the caller reads nothing back.
 */

const TICK_WRAP = 0x1c;
const ARM_SUBSTATE = 0x0d;
const PLAY_SUBSTATE = 0x03;
const SEED = 0x10; // frame-delay / anim-hold / rope-timer reload at level start

/** HUD setup, gauge + marker, timer seeds, spawn driver, sprite rebuild. */
function levelStartBatch(m) {
  const { mem8 } = m;
  loc_1ead(m); // bonus/round HUD setup + per-frame update chain
  paintPhaseGauge(m);
  loc_4a0b(m); // round marker (odd rounds only)
  mem8[LEAD_ACTOR_FRAME_DELAY] = SEED;
  mem8[TWOTILE_ANIM_HOLD] = SEED;
  mem8[ROPE_DRAW_STEP_TIMER] = SEED;
  loc_540d(m); // enemy-spawn driver
  loc_02ef(m); // sprite display-list rebuild
}

/** Raise the round-in-progress flag and seat the wave-arrival counter. */
function markInProgress(mem8) {
  mem8[ROUND_IN_PROGRESS] = 1;
  mem8[WAVE_ARRIVAL_COUNTER] = 2;
}

export function loc_175d(m) {
  const { mem8 } = m;
  loc_4381(m);

  mem8[SUBPHASE_TICK] = u8(mem8[SUBPHASE_TICK] + 1);
  if (mem8[SUBPHASE_TICK] !== TICK_WRAP) return; // not at the wrap yet
  mem8[SUBPHASE_TICK] = 0;

  const armed = mem8[FORMATION_SLOT_TABLE]; // pre-increment value gates the one-shot
  mem8[FORMATION_SLOT_TABLE] = u8(armed + 1);
  if (armed === 0) return; // first wrap arms it
  mem8[FORMATION_SLOT_TABLE] = 0; // second wrap clears it and proceeds

  if (mem8[PLAY_MODE_LATCH] !== 0) { mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return; }
  if (mem8[ROUND_IN_PROGRESS] !== 0) {
    levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }
  if (mem8[GAME_ACTIVE_FLAG] === 0) {
    markInProgress(mem8); levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }
  if (mem8[ROUND_COUNTER] & 0x01) { mem8[PLAY_STATE_INDEX] = ARM_SUBSTATE; return; }
  if (mem8[ROUND_COUNTER] !== 0) {
    markInProgress(mem8); levelStartBatch(m); mem8[PLAY_STATE_INDEX] = PLAY_SUBSTATE; return;
  }
  mem8[PLAY_STATE_INDEX] = ARM_SUBSTATE; // round 0, even -> arm sub-state
}
