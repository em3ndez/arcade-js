// SPDX-License-Identifier: GPL-3.0-only
/**
 * incrementCreditCount — bank one credit and cue the credit-count HUD redraw.
 *
 * WHAT IT IS
 *   The direct add-a-credit path in the coin/credit front-end (mechanisms.md "Coins and
 *   credits"). Both callers — tickCoinMeterAndAwardCredits and the two-coins-per-credit path
 *   awardCreditEverySecondCoin — pass the credit-count cell 0x4002 as `cell`. It steps that
 *   counter toward a hard ceiling of 99: at the ceiling it stops, above it it pins back down, and
 *   below it it increments, flags the redraw, and queues the HUD command.
 *
 * ROLE IN THE MACHINE
 *   0x4002 as the credit count is corroborated across clampCreditsToMax, driveStartButtonLamps,
 *   and advanceGameStateOnCredit (the latter is what tips attract into press-start once credits
 *   are nonzero). loc_41c9 (0x41c9) is the ready flag that arms driveRisingPitchRamp, giving the
 *   coin-insert its rising blip. The queued command word (channel 7, param 1) defers the on-screen
 *   credit-count redraw through the command queue. The 99 ceiling keeps the display to two digits.
 *
 * ROM 0x194f.  Grounding: [seen].
 *
 * LIVE-OUT: at/over ceiling, unchanged (over: clamped to 99 by clampCreditsToMax); else
 * mem8[cell]+1, loc_41c9=1, and a (7,1) command word enqueued.
 */
import { loc_41c9 } from "./names.js";
import { clampCreditsToMax } from "./clampCreditsToMax.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const CEILING = 99;

export function incrementCreditCount(m, cell = m.regs.hl) {
  const { mem8 } = m;

  // Three-way guard on the current count. Exactly at 99: nothing to do. Somehow past 99 (a corrupt
  // or externally-set value): delegate to clampCreditsToMax to force it back to exactly 99.
  const value = mem8[cell];
  if (value === CEILING) return;                          // already at the ceiling
  if (value > CEILING) return clampCreditsToMax(m, cell); // overshot -> pin back down

  // Normal case: bank the credit, raise the ready flag (arms the coin-insert pitch blip), and
  // queue the credit-count HUD redraw. The command word is (channel 7 << 8) | param 1.
  mem8[cell] = mem8[cell] + 1; // bump toward the ceiling
  mem8[loc_41c9] = 1;          // raise the ready flag
  return enqueueCommandWord(m, (7 << 8) | 1); // queue command word (channel 7, param 1)
}
