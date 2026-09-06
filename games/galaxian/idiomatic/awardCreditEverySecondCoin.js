// SPDX-License-Identifier: GPL-3.0-only
// Two-phase coin toggle. If the phase flag's low bit is clear, this is the first coin of a pair -> raise the
// flag. If it is already set, this completes a pair -> clear the flag and advance the credit counter.
import { loc_4001, loc_4002 } from "./names.js";
import { setCoinPhaseFlag } from "./setCoinPhaseFlag.js";
import { incrementCreditCount } from "./incrementCreditCount.js";

export function awardCreditEverySecondCoin(m) {
  const { mem8 } = m;

  if (!(mem8[loc_4001] & 1)) return setCoinPhaseFlag(m, loc_4001);

  mem8[loc_4001] = 0;
  return incrementCreditCount(m, loc_4002);
}
