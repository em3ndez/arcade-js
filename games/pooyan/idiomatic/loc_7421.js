// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { WAVE_HOLD_TIMER, TILE_ANIM_PARITY, ENEMY_ACTOR_TABLE, PLAY_STATE_INDEX, LATCHED_ENEMY_X, ATTRACT_SUBSTATE } from "./names.js";
/**
 * loc_7421 — bonus-stage teardown (phase 2).
 *
 * While the wave-hold timer is non-zero it just ticks it down and returns. On expiry it clears the
 * 9-byte wave/phase block and the 0x48-byte enemy-record region to zero, clears the play sub-state
 * index and the latched enemy X, and sets the attract sub-state selector to 7 to hand control back
 * out of the bonus stage.
 *
 * LIVE-OUT: memory only — a state-dispatch handler; the dispatcher does not read back its registers.
 */

const FILL_ZERO = 0x00;
const ATTRACT_STATE_AFTER_BONUS = 0x07;

export function loc_7421(m) {
  const { mem8 } = m;

  if (mem8[WAVE_HOLD_TIMER] !== 0) {
    mem8[WAVE_HOLD_TIMER] = mem8[WAVE_HOLD_TIMER] - 1;
    return;
  }
  loc_0010(m, TILE_ANIM_PARITY, FILL_ZERO, 0x09);
  loc_0010(m, ENEMY_ACTOR_TABLE, FILL_ZERO, 0x48);
  mem8[PLAY_STATE_INDEX] = FILL_ZERO;
  mem8[LATCHED_ENEMY_X] = FILL_ZERO;
  mem8[ATTRACT_SUBSTATE] = ATTRACT_STATE_AFTER_BONUS;
}
