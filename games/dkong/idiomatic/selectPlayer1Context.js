// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer1Context — reset the live player/display context to player 1, single-player,
 * sub-state 0, with the flip-screen latch forced ON (upright orientation).
 *
 * LIVE-OUT: memory (the three work-RAM bytes, all cleared to 0) plus the flip-screen latch, which
 * is a board output rather than work RAM.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, GAME_SUBSTATE } from "./names.js";

// The flip-screen control latch — a board hardware register, not work RAM.
const FLIPSCREEN = 0x7d82;

export function selectPlayer1Context(m) {
  const { mem8 } = m;
  mem8[CURRENT_PLAYER] = 0;
  mem8[ACTIVE_PLAYER_INDEX] = 0;
  mem8[GAME_SUBSTATE] = 0;
  mem8[FLIPSCREEN] = 1;
}
