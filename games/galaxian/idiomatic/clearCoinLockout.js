// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearCoinLockout -- release the coin mechanism by clearing the coin-lockout latch.
 *
 * WHAT IT IS
 *   A single-store routine. It writes 0 into the coin-lockout hardware latch COIN_LOCKOUT (0x6002),
 *   whose bit 0 is the board's coin_lock output. Writing 0 de-energizes the lockout coil, so the coin
 *   mechanism accepts coins again; writing 1 (done by the caller's engage path) energizes it and blocks
 *   the slot. Nothing here is conditional -- the release decision lives one level up.
 *
 * ROLE IN THE MACHINE
 *   The release half of the credit-driven coin gate. updateCoinLockoutFromCredits (0x197c) reads the
 *   credit count 0x4002 and drives the latch off it: at nine or more banked credits it calls this
 *   routine to release the lockout, and below nine it engages the latch directly (COIN_LOCKOUT=1).
 *
 * ROM 0x1989.  Grounding: [seen].
 *
 * LIVE-OUT: COIN_LOCKOUT (0x6002) := 0.  Returns nothing; touches no registers.
 */
import { COIN_LOCKOUT } from "./names.js";

export function clearCoinLockout(m) {
  const { mem8 } = m;
  // De-energize the lockout coil: 0 on the coin_lock output re-opens the coin mechanism.
  mem8[COIN_LOCKOUT] = 0;
}
