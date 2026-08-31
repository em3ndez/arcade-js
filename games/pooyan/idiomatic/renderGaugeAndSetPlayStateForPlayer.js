// SPDX-License-Identifier: GPL-3.0-only
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { ACTIVE_PLAYER, PLAY_STATE_INDEX } from "./names.js";
/**
 * Redraw the phase gauge, then set the play sub-state index for the active player.
 *
 * First repaints the phase gauge. Then it stores the base play sub-state index, plus one
 * when the active-player selector is set, so downstream code lands on that player's bank.
 *
 * LIVE-OUT: memory only (the gauge tiles and the play sub-state index); no register survives.
 */
const PLAY_STATE_BASE = 0x0a; // base play sub-state index (bumped for the second player)

export function renderGaugeAndSetPlayStateForPlayer(m) {
  const { mem8 } = m;
  renderPhaseGauge(m);
  mem8[PLAY_STATE_INDEX] = mem8[ACTIVE_PLAYER] !== 0 ? PLAY_STATE_BASE + 1 : PLAY_STATE_BASE;
}
