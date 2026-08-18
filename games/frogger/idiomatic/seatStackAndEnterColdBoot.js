// SPDX-License-Identifier: GPL-3.0-only
/**
 * seatStackAndEnterColdBoot — the reset vector. A dead self-check arm reads the unmapped self-check
 * source (it floats high, never the value its jump would need), the watchdog is kicked, then the routine
 * hands back the cold-boot init directly; initColdBootAndEnterMainLoop returns the main-loop generator
 * the engine drives. The Z80 SP is not seated: the born-live layer uses JS calls, not the Z80 stack, and
 * the engine's vblank-NMI push16 is never popped. It writes no RAM of its own. LIVE-OUT: memory via the tail.
 */
import { WATCHDOG_RESET_PORT, SELF_CHECK_SOURCE } from "./names.js";
import { initColdBootAndEnterMainLoop } from "./initColdBootAndEnterMainLoop.js";

export function seatStackAndEnterColdBoot(m) {
  if (m.mem8[SELF_CHECK_SOURCE] === 0x55) {
    throw new Error("seatStackAndEnterColdBoot: self-check jump armed -- self-check source read 0x55 (must float 0xFF)");
  }
  m.mem8[WATCHDOG_RESET_PORT];
  return initColdBootAndEnterMainLoop(m);
}
