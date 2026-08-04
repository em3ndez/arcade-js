// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer1Context — reset the live player/display context to player 1, single-player,
 * sub-state 0, with the flip-screen latch forced ON.
 *
 * One handler of the in-game sub-state sequence, reached on the player-switch path. It reads
 * nothing and writes four FIXED bytes — a constant function of no inputs:
 *
 *   - CURRENT_PLAYER      = 0  -> player 1 is up
 *   - ACTIVE_PLAYER_INDEX = 0  -> player 1 is the active player. This is the active-player
 *                                index, the low byte of a two-byte pair and a lockstep mirror
 *                                of CURRENT_PLAYER; it doubles as the "one-player start"
 *                                marker a later reader tests for zero. It is NOT the
 *                                two-player flag, which is the pair's HIGH byte and is left
 *                                untouched here.
 *   - GAME_SUBSTATE       = 0  -> restart the in-game sub-state sequence
 *   - the flip-screen latch = 1 -> upright orientation (player 1 never sees the cocktail
 *                                mirror)
 *
 * This is the player-1 half of a mirror pair. Its player-2 counterpart sets the same two
 * player bytes to 1 instead, and takes the flip latch from the cabinet orientation switch, so
 * a cocktail player 2 gets the mirrored view.
 *
 * LIVE-OUT: memory (the three work-RAM bytes, all cleared to 0) plus the flip-screen latch,
 * which is a board output rather than work RAM.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, GAME_SUBSTATE } from "./names.js";

// The flip-screen control latch — a board hardware register, not work RAM, so it is a
// file-local constant.
const FLIPSCREEN = 0x7d82;

export function selectPlayer1Context(m) {
  const { mem } = m;
  mem.write8(CURRENT_PLAYER, 0); // player 1 is up
  mem.write8(ACTIVE_PLAYER_INDEX, 0); // player 1 is the active player
  mem.write8(GAME_SUBSTATE, 0); // restart the in-game sub-state sequence
  mem.write8(FLIPSCREEN, 1); // flip-screen ON (upright orientation)
}
