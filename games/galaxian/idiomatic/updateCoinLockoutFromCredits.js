// SPDX-License-Identifier: GPL-3.0-only
// Set the coin-lockout latch from the credit count: at nine or more, release the lockout;
// below nine, engage it.
import { clearCoinLockout } from "./clearCoinLockout.js";
import { loc_4002, COIN_LOCKOUT } from "./names.js";

const RELEASE_AT = 9;

export function updateCoinLockoutFromCredits(m) {
  const { mem8 } = m;
  const credits = mem8[loc_4002];

  // Enough credits banked: release the lockout.
  if (credits >= RELEASE_AT) return clearCoinLockout(m);

  // Below the release level: engage the lockout.
  mem8[COIN_LOCKOUT] = 1;
}
