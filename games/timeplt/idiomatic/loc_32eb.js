// SPDX-License-Identifier: GPL-3.0-only
/** loc_32eb — hold the machine still at power-on, then hand it to the foreground. Twelve passes
 *  count down in a work-RAM cell, each petting the watchdog 256 times; cell, pass and tick
 *  registers end at zero, the audio processor is told to go quiet, and control falls through into
 *  the routine that starts the machine. COLLAPSED: each tick spun a register zero-to-zero, which
 *  is time and nothing else. The TICKS stay, one watchdog write each — that count is io state no
 *  dump holds. ⚠ PLAIN: it tail-returns. LIVE-OUT: pass cell at zero, watchdog, audio latch, A. */


import { enableInterruptAndEnterForegroundLoop } from "./enableInterruptAndEnterForegroundLoop.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SEQUENCE_DELAY } from "./names.js";

const WATCHDOG = 0xc200;
const STORE_TO_A_FIXED_ADDRESS = 10;
const PASSES = 0x0c;
const TICKS_PER_PASS = 0x100;
const INTERRUPT_ENABLE_SOURCE = 0x4c87;

export function loc_32eb(m, value = m.regs.a) {
  const { regs, mem, mem8 } = m;

  mem.write8(WATCHDOG, value, STORE_TO_A_FIXED_ADDRESS);
  regs.hl = SEQUENCE_DELAY;
  mem8[SEQUENCE_DELAY] = PASSES;

  for (let pass = PASSES; pass > 0; pass--) {
    for (let tick = TICKS_PER_PASS; tick > 0; tick--) {
      mem.write8(WATCHDOG, value, STORE_TO_A_FIXED_ADDRESS);
    }
    mem8[SEQUENCE_DELAY] = pass - 1;
  }
  regs.bc = 0;

  regs.xor(regs.a);
  sendSoundCommand(m);

  regs.a = mem.read8(INTERRUPT_ENABLE_SOURCE);
  return enableInterruptAndEnterForegroundLoop(m);
}
