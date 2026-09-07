// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateCoinLockoutFromCredits (ROM 0x197c) -- drive the coin-lockout hardware from the credit bank.
 *
 * WHAT IT IS
 *   The Galaxian coin door has a lockout coil that physically rejects coins when energized. The game
 *   uses it to stop players banking more credits than the machine is willing to hold. This routine is
 *   the one-line policy that decides, from the current credit count, whether the door should accept or
 *   reject the next coin.
 *
 * ROLE IN THE MACHINE
 *   Part of the unconditional coin/credit service that runs every frame regardless of game state. It
 *   reads the credit count from loc_4002 (0x4002) and sets the coin-lockout latch COIN_LOCKOUT (0x6002,
 *   whose D0 is the coin_lock output line): once nine or more credits are banked it releases the lockout
 *   -- letting coins in -- and below nine it engages it. Release goes through clearCoinLockout (0x1989),
 *   which writes COIN_LOCKOUT = 0; engaging writes COIN_LOCKOUT = 1 here directly.
 *
 * Grounding: [seen] (names.js cert for 0x197c; coin/credit service described in mechanisms.md).
 *
 * LIVE-OUT: COIN_LOCKOUT (0x6002) set to 0 (released) or 1 (engaged).
 */
import { clearCoinLockout } from "./clearCoinLockout.js";
import { loc_4002, COIN_LOCKOUT } from "./names.js";

// The bank's ceiling: nine credits is the threshold at or above which the machine stops taking coins.
const RELEASE_AT = 9;

export function updateCoinLockoutFromCredits(m) {
  const { mem8 } = m;
  // Read the live credit tally the coin service maintains at loc_4002.
  const credits = mem8[loc_4002];

  // Enough credits banked: release the lockout.
  // At or above the ceiling the bank is considered "full enough" -- hand off to clearCoinLockout, which
  // drops COIN_LOCKOUT to 0 so the coin mechanism accepts coins, and return early.
  if (credits >= RELEASE_AT) return clearCoinLockout(m);

  // Below the release level: engage the lockout.
  // Under the ceiling the door should reject further coins, so energize the lockout coil (D0 = 1).
  mem8[COIN_LOCKOUT] = 1;
}
