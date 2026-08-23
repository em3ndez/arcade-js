// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import {
  CREDIT_COUNT,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
  PLAYER0_LIVES,
  PLAYER1_LIVES,
  GAUGE_PHASE_COUNTER,
  INPUT_PORT0,
} from "./names.js";

/**
 * startGameOnStartButtonPress — guarded trigger reached through a jump-table pointer.
 *
 * Bails while the credit count is zero. Chooses a status byte: the two-player flag itself when it
 * is zero (a guaranteed zero), else player 0's or player 1's life count picked by the active-player
 * flag, with the gauge-phase counter folded in. Bails if that folded status is nonzero (already
 * active). Then, when the input-port gate bits are set, enqueues sound command 0 and tails into the
 * follow-on handler. LIVE-OUT: none — void bails; the tail forwards the handler.
 */

const GATE_BITS = 0x18; // input-port bits that must be set to fire

export function startGameOnStartButtonPress(m) {
  const { mem8 } = m;

  if (mem8[CREDIT_COUNT] === 0) return; // no credit -> nothing to trigger

  let a, hl;
  if (mem8[TWO_PLAYER_FLAG] === 0) {
    a = 0;
    hl = TWO_PLAYER_FLAG; // status = the (zero) flag itself
  } else {
    a = mem8[GAUGE_PHASE_COUNTER]; // folded into the status
    hl = mem8[ACTIVE_PLAYER] !== 0 ? PLAYER0_LIVES : PLAYER1_LIVES;
  }
  if ((a | mem8[hl]) !== 0) return; // already active

  if ((mem8[INPUT_PORT0] & GATE_BITS) === 0) return; // gate bits clear
  queueSoundCommand00(m); // enqueue sound command 0
  return m.call(0x0d78); // tail into the follow-on handler
}
