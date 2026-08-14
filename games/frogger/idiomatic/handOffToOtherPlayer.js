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
  loc_8371, PLAY_FLAG, loc_83fd, loc_83b8, loc_83b9, loc_83b7,
  loc_83b6, loc_825a, loc_83c2, loc_83cb, loc_b810, loc_b80c,
} from "./names.js";

export function handOffToOtherPlayer(m) {
  const { mem8 } = m;
  mem8[loc_8371] = 0;
  if (mem8[PLAY_FLAG] === 1) return;

  const player = mem8[loc_83fd] ^ 0x03;
  mem8[loc_83fd] = player;
  mem8[loc_83b7] = mem8[player === 1 ? loc_83b8 : loc_83b9];
  mem8[loc_83b6] = 0;
  mem8[loc_825a] = 1;
  if (mem8[loc_83c2] === 0) return;

  const flip = mem8[loc_83cb] ^ 0x01;
  mem8[loc_83cb] = flip;
  mem8[loc_b810] = flip;
  mem8[loc_b80c] = flip;
}
