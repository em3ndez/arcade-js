// SPDX-License-Identifier: GPL-3.0-only
// Coin/credit timer tick. While the reload cell is nonzero, pulse the coin counter and count that cell
// down. Once it reaches zero: if the coarse timer is already spent, do nothing; otherwise tick the coarse
// timer down, refill the reload cell, and act on the config mode -- mode 3 does nothing, mode 1 runs the
// two-coins-per-credit path, mode 2 runs the credit step twice, and any other mode runs it once.
import { loc_4003, loc_4004, loc_4000, loc_4002 } from "./names.js";
import { pulseCoinCounter } from "./pulseCoinCounter.js";
import { awardCreditEverySecondCoin } from "./awardCreditEverySecondCoin.js";
import { incrementCreditCount } from "./incrementCreditCount.js";

const RELOAD_VALUE = 15; // refilled into the reload cell whenever the coarse timer ticks

export function loc_1931(m) {
  const { mem8 } = m;

  const reload = mem8[loc_4003];
  if (reload !== 0) return pulseCoinCounter(m, reload, loc_4003);

  if (mem8[loc_4004] === 0) return;
  mem8[loc_4004] = mem8[loc_4004] - 1;
  mem8[loc_4003] = RELOAD_VALUE;

  const mode = mem8[loc_4000];
  if (mode === 3) return;
  if (mode === 1) return awardCreditEverySecondCoin(m);
  if (mode === 2) incrementCreditCount(m, loc_4002);
  return incrementCreditCount(m, loc_4002);
}
