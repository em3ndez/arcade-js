// SPDX-License-Identifier: GPL-3.0-only
import { SAUCER_EXITING } from "./names.js";
import { retirePrize } from "./retirePrize.js";

// Raise the prize-landed flag, then deactivate the prize; value-out A.
export function markExitingAndRetire(m) {
  m.mem8[SAUCER_EXITING] = 0x01;
  return retirePrize(m);
}
