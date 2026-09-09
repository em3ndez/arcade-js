// SPDX-License-Identifier: GPL-3.0-only

/**
 * spinToSelfHalt -- a self-jump halt trap: hang the processor by re-entering itself forever. The clock
 * still advances each hop, so the frame/cycle budget (and the watchdog) can break the spin; dropping
 * that tick would wedge a real dispatch into an unbreakable loop. Writes nothing. [code]
 */
export function spinToSelfHalt(m) {
  m.step(0x3ff6, 3); // advance the clock so the spin stays breakable
  return m.call(0x3ff6); // re-enter self
}
