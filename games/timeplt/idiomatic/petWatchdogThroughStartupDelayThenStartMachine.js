// SPDX-License-Identifier: GPL-3.0-only
/** petWatchdogThroughStartupDelayThenStartMachine — hold the machine still at power-on, then hand it to the foreground. Twelve passes
 *  count down in a work-RAM cell, each petting the watchdog 256 times; the cell ends at zero, the
 *  audio processor is told to go quiet, and control falls through into the routine that starts the
 *  machine, carrying the interrupt-enable setting read from the program image. COLLAPSED: each tick spun a register zero-to-zero, which
 *  is time and nothing else. The TICKS stay, one watchdog write each — that count is io state no
 *  dump holds. ⚠ PLAIN: it tail-returns. LIVE-OUT: pass cell at zero, watchdog, audio latch. */


import { enableInterruptAndEnterForegroundLoop } from "./enableInterruptAndEnterForegroundLoop.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SEQUENCE_DELAY, WATCHDOG_RESET, NMI_ENABLE_BYTE } from "./names.js";

const PASSES = 0x0c;
const TICKS_PER_PASS = 0x100;

export function petWatchdogThroughStartupDelayThenStartMachine(m, value = m.regs.a) {
  const { mem8 } = m;

  mem8[WATCHDOG_RESET] = value;
  mem8[SEQUENCE_DELAY] = PASSES;

  for (let pass = PASSES; pass > 0; pass--) {
    for (let tick = TICKS_PER_PASS; tick > 0; tick--) {
      mem8[WATCHDOG_RESET] = value;
    }
    mem8[SEQUENCE_DELAY] = pass - 1;
  }

  sendSoundCommand(m, 0);

  return enableInterruptAndEnterForegroundLoop(m, mem8[NMI_ENABLE_BYTE]);
}
