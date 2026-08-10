// SPDX-License-Identifier: GPL-3.0-only
/** serviceVerticalBlankInterrupt — the vertical-blank service. Stack both register banks, refresh the sprite banks and
 * the deferred-cell lists, disarm the interrupt line and kick the watchdog, latch the five inverted
 * input/dip ports, step the frame and packed-decimal counters, wind three timers down toward zero,
 * run the per-frame subsystems, then dispatch one phase arm from an inline table and hand off to the
 * unwind that restores the interrupted code. LIVE-OUT: memory, the control latches, every register. */

import { publishSpriteShadow } from "./publishSpriteShadow.js";
import { drainBothDeferredCellLists } from "./drainBothDeferredCellLists.js";
import { serviceCoinInputs } from "./serviceCoinInputs.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt } from "./sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";
import { ATTACKER_SPAWN_COOLDOWN, BANK_LAUNCH_COOLDOWN, WAVE_CLAIM_TIMER } from "./names.js";

const NMI_ENABLE = 0xc300;
const WATCHDOG = 0xc200;
const SERVICE_LATCH = 0xc302;
const DIP1 = 0xc200;
const IN0 = 0xc300;
const IN1 = 0xc320;
const IN2 = 0xc340;
const DIP0 = 0xc360;

const SERVICE_FLAG = 0xa987;
const PRIMARY_GATE = 0xad32;
const SECONDARY_GATE = 0xa9c2;

const DIP1_MIRROR = 0xa9ad;
const IN0_MIRROR = 0xa9ae;
const IN1_MIRROR = 0xa9af;
const IN2_MIRROR = 0xa9b0;
const DIP0_MIRROR = 0xa9b1;

const FRAME_COUNTER = 0xa980;
const DECIMAL_COUNTER = 0xa9ce;
const TIMERS = [BANK_LAUNCH_COOLDOWN, WAVE_CLAIM_TIMER, ATTACKER_SPAWN_COOLDOWN];

const PHASE_INDEX = 0xa9ab;
const PHASE_TABLE = 0x015f;
const FRAME_EPILOGUE = 0x0174;

export function serviceVerticalBlankInterrupt(m) {
  const { regs, mem8 } = m;

  m.push16(regs.bc);
  m.push16(regs.de);
  m.push16(regs.hl);
  regs.exAf();
  regs.exx();
  m.push16(regs.af);
  m.push16(regs.bc);
  m.push16(regs.de);
  m.push16(regs.hl);
  m.push16(regs.ix);
  m.push16(regs.iy);

  publishSpriteShadow(m);
  drainBothDeferredCellLists(m);

  mem8[NMI_ENABLE] = 0;
  mem8[WATCHDOG] = 0;
  // Cleared only when the primary gate is armed while the secondary one reads clear.
  mem8[SERVICE_FLAG] = mem8[PRIMARY_GATE] !== 0 && mem8[SECONDARY_GATE] === 0 ? 0 : 1;
  mem8[SERVICE_LATCH] = mem8[SERVICE_FLAG];

  mem8[DIP1_MIRROR] = mem8[DIP1] ^ 0xff;
  mem8[IN0_MIRROR] = mem8[IN0] ^ 0xff;
  mem8[IN1_MIRROR] = mem8[IN1] ^ 0xff;
  mem8[IN2_MIRROR] = mem8[IN2] ^ 0xff;
  mem8[DIP0_MIRROR] = mem8[DIP0] ^ 0xff;

  mem8[FRAME_COUNTER] = mem8[FRAME_COUNTER] + 1;

  regs.a = regs.inc8(mem8[DECIMAL_COUNTER]);
  regs.daa();
  mem8[DECIMAL_COUNTER] = regs.a;

  for (const timer of TIMERS) if (mem8[timer] !== 0) mem8[timer] = mem8[timer] - 1;

  serviceCoinInputs(m);

  regs.a = mem8[PHASE_INDEX] & 0x03;
  regs.hl = PHASE_TABLE;
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.push16(FRAME_EPILOGUE); // the arm returns here, and the epilogue unwinds from there
  m.call(arm);
  return sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
}
