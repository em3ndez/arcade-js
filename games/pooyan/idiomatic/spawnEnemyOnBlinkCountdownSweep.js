// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6a35 } from "./loc_6a35.js";
import {
  BLINK_PHASE,
  ANIM_PHASE_TOGGLE_892C,
  BLINK_COUNTDOWN,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

const RECORD_COUNT = 18; // enemy-actor records swept per frame
const RECORD_STRIDE = 0x18;
const TOGGLE_GATE = 0x06; // phase-toggle value that suspends the sweep

/**
 * spawnEnemyOnBlinkCountdownSweep — enemy-spawn sweep driver.
 *
 * Does nothing while the blink phase is clear, while the phase toggle has reached its gate
 * value, or while the spawn-delay countdown is still running (each of those ticks just
 * decrements the countdown). Once the countdown reaches zero it sweeps the enemy-actor
 * records: an already-active record is skipped and the sweep continues, while the first empty
 * record is spawned into and aborts the sweep for this frame.
 *
 * LIVE-OUT: none — the memory effects are the per-record spawn and the countdown decrement.
 */
export function spawnEnemyOnBlinkCountdownSweep(m) {
  const { mem8 } = m;

  if (mem8[BLINK_PHASE] === 0) return;
  if (mem8[ANIM_PHASE_TOGGLE_892C] === TOGGLE_GATE) return;
  if (mem8[BLINK_COUNTDOWN] !== 0) {
    mem8[BLINK_COUNTDOWN] = mem8[BLINK_COUNTDOWN] - 1; // still counting down
    return;
  }

  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    if (!loc_6a35(m, rec)) return; // spawned -> abort the sweep
    rec = u16(rec + RECORD_STRIDE);
  }
}
