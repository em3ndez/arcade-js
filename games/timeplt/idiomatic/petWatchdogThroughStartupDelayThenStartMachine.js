// SPDX-License-Identifier: GPL-3.0-only
/**
 * petWatchdogThroughStartupDelayThenStartMachine — hold the machine still at power-on, then hand it
 * to the foreground.
 *
 * ROM 0x32EB-0x330A. Grounding: [seen] (names.js ROUTINES 0x32EB).
 *
 * ROLE IN THE MACHINE. The last-but-one link of the power-on chain, where each routine ends by
 * jumping into the next and none returns. finishBootSelfTestAndColdStart [seen] has just tiled the
 * character plane with its lattice of boxes; this routine keeps that picture on screen for a fixed
 * delay, then starts the machine proper through enableInterruptAndEnterForegroundLoop [seen]. Nothing
 * here depends on the game's state: the delay is a constant and runs identically on every boot.
 *
 * WHY THE WATCHDOG. The board resets the processor unless the watchdog address WATCHDOG_RESET
 * (0xC200, write side) is written often enough; the value written is ignored (names.js). A delay loop
 * that did nothing but spin would get the board reset under it, so every tick of the delay is a
 * watchdog write.
 *
 * PARAMETER. `value` is the byte the caller carries in (the self-test status finishBootSelfTestAndColdStart
 * hands on — zero on a genuine image). It is only ever written to the watchdog, which ignores it.
 *
 * COLLAPSED. In the ROM each tick is an inner `djnz` spin of a register from zero back to zero — time
 * and nothing else — followed by one watchdog write. The spin leaves no trace, so only the ticks
 * remain here, one watchdog write each: that count of writes is io the machine really performs.
 *
 * LIVE-OUT: SEQUENCE_DELAY left at zero, the watchdog writes, the audio latch (sound command 0), and
 * whatever the foreground entry does — control never comes back.
 */


import { enableInterruptAndEnterForegroundLoop } from "./enableInterruptAndEnterForegroundLoop.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { SEQUENCE_DELAY, WATCHDOG_RESET, NMI_ENABLE_BYTE } from "./names.js";

// Twelve outer passes (`ld (hl),0x0c` at 0x32F1), each of 256 watchdog ticks (C counted down from 0,
// i.e. 256, at 0x32FB).
const PASSES = 0x0c;
const TICKS_PER_PASS = 0x100;

export function petWatchdogThroughStartupDelayThenStartMachine(m, value = m.regs.a) {
  const { mem8 } = m;

  // Entry (0x32EB-0x32F3): kick the watchdog once, then arm the pass counter. The counter lives in
  // SEQUENCE_DELAY (0xA9EB) [seen] — the same cell the sequence machine later uses for its timed
  // holds; here it simply counts the startup passes.
  mem8[WATCHDOG_RESET] = value;
  mem8[SEQUENCE_DELAY] = PASSES;

  // The delay (0x32F3-0x3300): each pass pets the watchdog 256 times, then the ROM's `dec (hl)`
  // takes one pass off the counter in RAM. The cell therefore walks 12 -> 0 and is left at zero.
  for (let pass = PASSES; pass > 0; pass--) {
    for (let tick = TICKS_PER_PASS; tick > 0; tick--) {
      mem8[WATCHDOG_RESET] = value;
    }
    mem8[SEQUENCE_DELAY] = pass - 1;
  }

  // Quiet the audio processor (0x3301-0x3302 `xor a / call 0x55F8`): sound command 0 goes straight
  // through the audio latch by sendSoundCommand [seen], not through the game's sound queue.
  sendSoundCommand(m, 0);

  // Start the machine (0x3305-0x3308): read NMI_ENABLE_BYTE (ROM 0x4C87, holds 0x01) — the byte
  // whose low bit becomes the interrupt-enable line — and jump (not call) into
  // enableInterruptAndEnterForegroundLoop [seen], which arms the vertical-blank interrupt and enters
  // the foreground loop for good.
  return enableInterruptAndEnterForegroundLoop(m, mem8[NMI_ENABLE_BYTE]);
}
