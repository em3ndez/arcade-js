// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer2AndComposeScreen — make player 2 the current player, then compose this
 * player's screen.
 *
 * One of the two active-player arms taken at game over, when the handler above scans the
 * player slot records for an active player. That handler first clears the two-byte player
 * index to 0; a slot holding 1 goes straight to the compose tail with the player key 1, and a
 * slot holding 3 comes HERE. So this routine's own contribution is exactly "select player 2";
 * everything after is the shared compose tail it delegates to.
 *
 * It does two things, then delegates:
 *   1. SELECT PLAYER 2 — write 1 to both bytes of the player index. CURRENT_PLAYER == 1 is
 *      what makes player 2 the current player; score awards and the per-player context slot
 *      key off it. ACTIVE_PLAYER_INDEX is written in lockstep, as both arms do.
 *   2. COMPOSE with the player key 0. The compose tail sets the flip-screen latch to (key OR
 *      the cabinet orientation switch), so a key of 0 lets the cabinet alone decide flip —
 *      where the player-1 arm instead forces flip on with a key of 1. The tail then clears the
 *      sub-state timer, advances GAME_SUBSTATE, and posts the twelve screen-draw tasks.
 *
 * The key reaches the tail through the accumulator, which is where the tail reads it.
 *
 * LIVE-OUT: memory plus the flip-screen latch, which is a board output rather than work RAM.
 * Memory: CURRENT_PLAYER and ACTIVE_PLAYER_INDEX set to 1, plus everything the compose tail
 * writes — the sub-state timer, GAME_SUBSTATE, and the task ring.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX } from "./names.js";
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js";

export function selectPlayer2AndComposeScreen(m) {
  const { regs, mem } = m;

  // 1. Select player 2: write 1 to both bytes of the player index. The other arm leaves them
  //    at the 0 they were cleared to (player 1 up); this arm sets them to 1, and
  //    CURRENT_PLAYER == 1 means player 2 is up.
  mem.write8(ACTIVE_PLAYER_INDEX, 0x01);
  mem.write8(CURRENT_PLAYER, 0x01);

  // 2. Compose this player's screen with the player key 0. The tail reads the key out of the
  //    accumulator to build the flip-screen latch (key OR the cabinet orientation switch), so
  //    0 lets the cabinet alone decide flip. It also clears the sub-state timer, advances
  //    GAME_SUBSTATE, and posts the twelve screen-draw tasks.
  regs.a = 0x00;
  configureFlipScreenAndComposeScreen(m);
}
