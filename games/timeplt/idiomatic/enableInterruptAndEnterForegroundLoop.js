// SPDX-License-Identifier: GPL-3.0-only

import { WATCHDOG_RESET, NMI_ENABLE_LATCH, runCommandRingDrainLoop_ADDR } from "./names.js";

export function* enableInterruptAndEnterForegroundLoop(m, value = m.regs.a) {
  const { mem8 } = m;
  mem8[NMI_ENABLE_LATCH] = value;
  mem8[WATCHDOG_RESET] = value;
  return yield* m.call(runCommandRingDrainLoop_ADDR);
}
