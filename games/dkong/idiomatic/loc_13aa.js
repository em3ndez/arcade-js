// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13aa — small in-game state reset: mirror the cabinet DIP into the flip-screen latch, clear
 * the sub-state, and set the player-context word to 1.
 *
 * One of the in-game sub-state handlers that run while a credited game is in progress. It is a
 * small, almost input-free state reset: it reads exactly ONE byte and produces four fixed effects,
 * and nothing branches.
 *
 *   - Copy DIP_UPRIGHT, the cabinet-orientation DIP, into the flip-screen latch. That latch is an
 *     I/O port, NOT work RAM — the memory seam routes the write to the flip-screen output and only
 *     bit 0 of the stored byte reaches it.
 *   - Clear GAME_SUBSTATE to 0.
 *   - Set CURRENT_PLAYER to 1 and the adjacent ACTIVE_PLAYER_INDEX to 1 (the low and high halves of
 *     one 16-bit store on the hardware).
 *
 * THE NAME STAYS loc_ on purpose. The memory mechanics above are certain, but the game-level MEANING
 * of this reset — why a sub-state clears GAME_SUBSTATE mid-game, and what ACTIVE_PLAYER_INDEX == 1
 * signifies next to CURRENT_PLAYER — is a single-proposer hypothesis. The readers that would
 * discriminate it are not exercised in attract, so the lockstep value here is trusted while its
 * game-level role is not. A "set flip from the DIP but current-player to the second player" reading
 * is not even internally clean, so a confident English name would over-assert.
 *
 * LIVE-OUT: memory-only, plus the flip-screen I/O latch — GAME_SUBSTATE, CURRENT_PLAYER,
 * ACTIVE_PLAYER_INDEX and the latch. The dispatcher discards the return and issues no register read
 * afterwards.
 */

import { DIP_UPRIGHT, GAME_SUBSTATE, CURRENT_PLAYER, ACTIVE_PLAYER_INDEX } from "./names.js";

// The flip-screen latch — an addressed output pin, not work RAM. The memory seam masks the stored
// byte down to bit 0 on its way to the hardware.
const FLIP_SCREEN_LATCH = 0x7d82;

export function loc_13aa(m) {
  const { mem } = m;

  // Mirror the cabinet-orientation DIP into the flip-screen latch.
  mem.write8(FLIP_SCREEN_LATCH, mem.read8(DIP_UPRIGHT));

  // Clear the in-game sub-state index.
  mem.write8(GAME_SUBSTATE, 0);

  // Set CURRENT_PLAYER and the adjacent ACTIVE_PLAYER_INDEX to 1. Both land in plain work RAM, so
  // the write order is immaterial.
  mem.write8(CURRENT_PLAYER, 1);
  mem.write8(ACTIVE_PLAYER_INDEX, 1);
}
