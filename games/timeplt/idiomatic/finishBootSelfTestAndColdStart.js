// SPDX-License-Identifier: GPL-3.0-only
/** finishBootSelfTestAndColdStart — the tail of the power-on config decode and self-test. Two bits of the rolled config
 * byte land in a work-RAM pair, the watchdog is kicked, an LS259 line is driven from a fixed byte,
 * and the character plane is tiled. A 256-byte block is then summed and compared to a fixed total,
 * and a mismatch derails into the frame handler; a good image cold-starts and does not return.
 * LIVE-OUT: memory, the LS259 latch, and the watchdog kicks. */

import { u16 } from "../../../core/int.js";
import { tileCharPlaneWithBoxLattice } from "./tileCharPlaneWithBoxLattice.js";
import { saveAccumulatorForFrameInterrupt } from "./saveAccumulatorForFrameInterrupt.js";
import { petWatchdogThroughStartupDelayThenStartMachine } from "./petWatchdogThroughStartupDelayThenStartMachine.js";
import { DEMO_SOUNDS_ENABLE, DIFFICULTY_SETTING, WATCHDOG_RESET, FLIPSCREEN_LATCH, FLIPSCREEN_INIT_BYTE, BOOT_SELFTEST_CHECKSUM_BASE } from "./names.js";

const STORE = 10;
const CHECKSUM_SPAN = 0x100;
const CHECKSUM_TOTAL = 0xc5;

export function finishBootSelfTestAndColdStart(m) {
  const { regs, mem, mem8 } = m;

  regs.rrca();
  const rolled = regs.a;
  regs.and(0x07);
  mem8[DIFFICULTY_SETTING] = regs.a;

  regs.a = rolled;
  regs.rrca();
  regs.rrca();
  regs.rrca();
  regs.and(0x01);
  mem8[DEMO_SOUNDS_ENABLE] = regs.a;
  mem.write8(WATCHDOG_RESET, regs.a, STORE);

  regs.a = mem8[FLIPSCREEN_INIT_BYTE];
  mem.write8(FLIPSCREEN_LATCH, regs.a, STORE);

  tileCharPlaneWithBoxLattice(m);

  let total = 0;
  for (let i = 0; i < CHECKSUM_SPAN; i++) {
    total = (total + mem8[u16(BOOT_SELFTEST_CHECKSUM_BASE + i)]) & 0xff;
  }
  regs.a = (total - CHECKSUM_TOTAL) & 0xff;
  if (regs.a !== 0) return saveAccumulatorForFrameInterrupt(m); // tampered image: derail into the frame handler
  return petWatchdogThroughStartupDelayThenStartMachine(m);
}
