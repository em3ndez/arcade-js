// SPDX-License-Identifier: GPL-3.0-only
import { loc_4003, loc_4004, loc_4000, loc_4002 } from "./names.js";
import { pulseCoinCounter } from "./pulseCoinCounter.js";
import { awardCreditEverySecondCoin } from "./awardCreditEverySecondCoin.js";
import { incrementCreditCount } from "./incrementCreditCount.js";

const RELOAD_VALUE = 15; // refilled into the reload cell whenever the coarse timer ticks

/**
 * tickCoinMeterAndAwardCredits (ROM 0x1931) -- the per-frame coin metering / credit grant.
 *
 * WHAT IT IS
 *   The back half of the coin path. serviceCoinInputs (the front end) registers a coin drop by ticking the
 *   coarse coin counter loc_4004 (0x4004); this routine, run unconditionally every frame, both drives the
 *   physical coin-counter output over a short reload window and, once that window closes, converts one
 *   coarse count into credit(s) according to the coinage DIP mode loc_4000 (0x4000).
 *
 * ROLE IN THE MACHINE
 *   Part of the background service cluster the interrupt runs ahead of every dispatch, so credits
 *   accumulate regardless of game phase (see mechanisms.md "Coins and credits"). Two co-operating timers:
 *   the reload cell loc_4003 (0x4003) paces the mechanical coin-counter pulse; the coarse counter loc_4004
 *   is the queue of coins still waiting to be metered.
 *
 * Grounding: [seen] (names.js ROUTINES 0x1931). Cell identifiers loc_4000/4002/4003/4004 are firm
 *   code-level readings still carrying placeholder names.
 *
 * LIVE-OUT: memory + the command queue (credit awards enqueue a channel-7 HUD redraw via their delegates).
 *   Writes loc_4004, loc_4003, and -- through the delegates -- the credit count loc_4002 (0x4002).
 */
export function tickCoinMeterAndAwardCredits(m) {
  const { mem8 } = m;

  // While the reload cell loc_4003 (0x4003) is nonzero we are inside a coin-counter pulse window: hand it
  // to pulseCoinCounter (which latches the physical counter output and counts loc_4003 down) and stop.
  const reload = mem8[loc_4003];
  if (reload !== 0) return pulseCoinCounter(m, reload, loc_4003);

  // Reload window closed. If no coin is queued in the coarse counter loc_4004 (0x4004) there is nothing to
  // meter this frame -- done.
  if (mem8[loc_4004] === 0) return;
  // Consume one queued coin and re-open the pulse window (refill loc_4003 to 15) for the next coin.
  mem8[loc_4004] = mem8[loc_4004] - 1;
  mem8[loc_4003] = RELOAD_VALUE;

  // Award credit(s) per the coinage DIP mode loc_4000 (0x4000):
  //   mode 3 (free play/preset): meter only, award nothing here.
  //   mode 1: two coins per credit -- delegate to the toggle path awardCreditEverySecondCoin.
  //   mode 2: one coin / two credits -- run the credit step twice (the if-arm plus the fall-through).
  //   any other mode (0): one credit -- the single fall-through incrementCreditCount.
  const mode = mem8[loc_4000];
  if (mode === 3) return;
  if (mode === 1) return awardCreditEverySecondCoin(m);
  if (mode === 2) incrementCreditCount(m, loc_4002);
  return incrementCreditCount(m, loc_4002);
}
