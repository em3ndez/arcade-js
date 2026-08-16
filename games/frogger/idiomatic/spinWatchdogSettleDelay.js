// SPDX-License-Identifier: GPL-3.0-only
/**
 * spinWatchdogSettleDelay — a power-on settle delay: each pass reads the watchdog port to keep the dog fed.
 * COLLAPSED the time-only pass counter; the reads stay, their count being io state no dump holds.
 * LIVE-OUT: the watchdog read count (io); memory unchanged.
 */
import { WATCHDOG_RESET_PORT } from "./names.js";

const SETTLE_PASSES = 61439;

export function spinWatchdogSettleDelay(m) {
  const { mem } = m;
  for (let pass = 0; pass < SETTLE_PASSES; pass++) mem.read8(WATCHDOG_RESET_PORT);
}
