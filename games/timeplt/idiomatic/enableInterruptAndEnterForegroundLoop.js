// SPDX-License-Identifier: GPL-3.0-only
/** enableInterruptAndEnterForegroundLoop — open the frame interrupt and enter the foreground for good. The
 * setting it is handed drives the interrupt-enable line from its low bit and kicks the watchdog, then
 * control passes into the command-ring loop, which never comes back. LIVE-OUT: the interrupt-enable
 * line, the watchdog, and whatever the loop leaves. */

import { runCommandRingDrainLoop } from "./runCommandRingDrainLoop.js";
import { WATCHDOG_RESET, NMI_ENABLE_LATCH } from "./names.js";

export function* enableInterruptAndEnterForegroundLoop(m, setting) {
  const { mem8 } = m;
  mem8[NMI_ENABLE_LATCH] = setting;
  mem8[WATCHDOG_RESET] = setting;
  return yield* runCommandRingDrainLoop(m);
}
