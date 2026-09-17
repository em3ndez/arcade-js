// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13aa — small in-game state reset: mirror the cabinet DIP into the flip-screen latch, clear
 * the sub-state, and set CURRENT_PLAYER and the adjacent ACTIVE_PLAYER_INDEX to 1. The name stays
 * loc_ because the game-level meaning of the reset is a single-proposer hypothesis.
 *
 * LIVE-OUT: memory-only, plus the flip-screen I/O latch.
 */

import { DIP_UPRIGHT, GAME_SUBSTATE, CURRENT_PLAYER, ACTIVE_PLAYER_INDEX } from "./names.js";

const FLIP_SCREEN_LATCH = 0x7d82; // output pin, not work RAM; seam masks to bit 0

export function loc_13aa(m) {
  const { mem, mem8 } = m;

  // Mirror the cabinet-orientation DIP into the flip-screen latch (both device-routed).
  mem.write8(FLIP_SCREEN_LATCH, mem.read8(DIP_UPRIGHT));

  mem8[GAME_SUBSTATE] = 0;

  mem8[CURRENT_PLAYER] = 1;
  mem8[ACTIVE_PLAYER_INDEX] = 1;
}
