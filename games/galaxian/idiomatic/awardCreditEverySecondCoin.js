// SPDX-License-Identifier: GPL-3.0-only
import { loc_4001, loc_4002 } from "./names.js";
import { setCoinPhaseFlag } from "./setCoinPhaseFlag.js";
import { incrementCreditCount } from "./incrementCreditCount.js";

/**
 * awardCreditEverySecondCoin — the two-coins-per-credit coinage path: award one credit for every
 * second coin inserted.
 *
 * WHAT IT IS
 *   The mode-1 arm of the coin dispatcher tickCoinMeterAndAwardCredits. Under the "2 coins / 1 credit"
 *   coinage setting, a running coin does not always bank a credit; this routine toggles a phase flag so
 *   the credit lands only on the second coin of each pair.
 *
 * ROLE IN THE MACHINE
 *   loc_4001 (0x4001) is the coin-phase flag; its low bit tracks whether we are between the two coins
 *   of a pair. On a coin edge tickCoinMeterAndAwardCredits calls here:
 *     - flag bit0 clear -> this is the first coin of a pair: delegate to setCoinPhaseFlag(0x4001) to
 *       raise the flag and wait for the next coin (no credit yet).
 *     - flag bit0 set -> this completes the pair: clear the flag and delegate to
 *       incrementCreditCount(loc_4002) to bank one credit into the credit count at 0x4002.
 *   incrementCreditCount steps 0x4002 toward its ceiling of 99, sets the credit-ready flag, and queues
 *   the credit-HUD redraw. loc_4002 as the credit count is corroborated across
 *   clampCreditsToMax/driveStartButtonLamps/advanceGameStateOnCredit.
 *
 * ROM 0x1964.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: on the first coin, whatever setCoinPhaseFlag returns; on the second, loc_4001 = 0 and the
 * incrementCreditCount result (credit count at 0x4002 advanced).
 */

export function awardCreditEverySecondCoin(m) {
  const { mem8 } = m;

  // First coin of a pair (phase flag low bit clear): raise the flag and bank nothing yet.
  if (!(mem8[loc_4001] & 1)) return setCoinPhaseFlag(m, loc_4001);

  // Second coin (flag already set): clear the phase flag and award the credit into 0x4002.
  mem8[loc_4001] = 0;
  return incrementCreditCount(m, loc_4002);
}
