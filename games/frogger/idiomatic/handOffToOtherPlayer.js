// SPDX-License-Identifier: GPL-3.0-only
/**
 * handOffToOtherPlayer — hand play to the other player, and when cocktail is enabled toggle the screen flip.
 *
 * Returns early in a one-player game. Otherwise toggles the active-player bits, loads that player's
 * lives, resets two per-player cells, and — when cocktail is enabled — toggles the flip latch and
 * mirrors it to the flip_x/flip_y IO latches.
 * LIVE-OUT: memory-only.
 */
import {
  PER_TURN_SCRATCH, PLAY_FLAG, ACTIVE_PLAYER, PLAYER1_LIVES, PLAYER2_LIVES, LIVES_COUNT,
  PER_PLAYER_RESET_CELL, PLAYER_START_DEMO_FLAG, COCKTAIL_ENABLED_FLAG, SCREEN_FLIP_LATCH, FLIP_X_LATCH, FLIP_Y_LATCH,
} from "./names.js";

export function handOffToOtherPlayer(m) {
  const { mem8 } = m;
  mem8[PER_TURN_SCRATCH] = 0;
  if (mem8[PLAY_FLAG] === 1) return;

  const player = mem8[ACTIVE_PLAYER] ^ 0x03;
  mem8[ACTIVE_PLAYER] = player;
  mem8[LIVES_COUNT] = mem8[player === 1 ? PLAYER1_LIVES : PLAYER2_LIVES];
  mem8[PER_PLAYER_RESET_CELL] = 0;
  mem8[PLAYER_START_DEMO_FLAG] = 1;
  if (mem8[COCKTAIL_ENABLED_FLAG] === 0) return;

  const flip = mem8[SCREEN_FLIP_LATCH] ^ 0x01;
  mem8[SCREEN_FLIP_LATCH] = flip;
  mem8[FLIP_X_LATCH] = flip;
  mem8[FLIP_Y_LATCH] = flip;
}
