// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchEnemyActorState } from "./dispatchEnemyActorState.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  ENEMY_ACTOR_TABLE,
  WAVE_NUMBER,
  LAUNCH_FLIP_COUNTDOWN,
  FLIP_ANIM_DISPLAY_CMD,
  FLIP_ANIM_DISPLAY_CMD_ALT,
} from "./names.js";
/**
 * updateEnemyActorsAndCycleLaunchFlipAnim — step three enemy-actor records through their per-frame state pass, then run the
 * flip-command cadence.
 *
 * Dispatches three consecutive records (stride 0x18) starting at IX through their state handler.
 * Afterwards, unless the enemy table's lead state byte is clear (in which case it stops), it steps a
 * per-frame countdown: while the count is live it just decrements it; when the count reaches zero it
 * reloads the countdown, advances the flip toggle, and enqueues a display command — the primary
 * variant when the toggle's low bit is set, the alternate when it is clear.
 *
 * LIVE-OUT: none (memory only) — the record pointer is a local scan cursor and the caller reloads
 * IX before its next use, reading no register back.
 */

const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 3;
const LEAD_STATE_OFFSET = 0x02; // enemy table's lead state byte, gates the post-pass work
const COUNTDOWN_RELOAD = 0x10;

export function updateEnemyActorsAndCycleLaunchFlipAnim(m, rec = m.regs.ix) {
  const { mem8 } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    dispatchEnemyActorState(m, rec);
    rec = u16(rec + RECORD_STRIDE);
  }

  if (mem8[ENEMY_ACTOR_TABLE + LEAD_STATE_OFFSET] === 0) return; // lead state clear -> stop

  if (mem8[WAVE_NUMBER] !== 0) {
    mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] - 1; // count still live
    return;
  }

  mem8[WAVE_NUMBER] = COUNTDOWN_RELOAD; // count expired -> reload
  mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] + 1; // advance the flip toggle
  const cmd = (mem8[LAUNCH_FLIP_COUNTDOWN] & 0x01) ? FLIP_ANIM_DISPLAY_CMD : FLIP_ANIM_DISPLAY_CMD_ALT;
  enqueueDisplayCommand(m, cmd);
}
