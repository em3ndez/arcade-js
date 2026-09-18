// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayer2AndComposeScreen — the game-over arm for an active player 2: write 1 to both bytes
 * of the player index (CURRENT_PLAYER == 1 makes player 2 current), then delegate to the shared
 * compose tail with player key 0, so the cabinet orientation switch alone decides screen flip.
 *
 * LIVE-OUT: memory plus the flip-screen latch (a board output) written by the compose tail.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX } from "./names.js";
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js";

export function selectPlayer2AndComposeScreen(m) {
  const { mem8 } = m;

  mem8[ACTIVE_PLAYER_INDEX] = 0x01;
  mem8[CURRENT_PLAYER] = 0x01;

  configureFlipScreenAndComposeScreen(m, 0x00);
}
