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
import { ACTIVE_PLAYER, ATTACKER_SPAWN_COOLDOWN, BANK_LAUNCH_COOLDOWN, BCD_FRAME_COUNTER, COCKTAIL_MODE, COINAGE_SETTINGS, DIP1_MIRROR, FRAME_TICK, IN0_MIRROR, IN1_MIRROR, IN2_MIRROR, SCREEN_UNFLIPPED, SEQUENCE_PHASE, WAVE_CLAIM_TIMER, loc_0174, loc_015f, loc_c200, loc_c300, loc_c302, loc_c320, loc_c340, loc_c360 } from "./names.js";

const TIMERS = [BANK_LAUNCH_COOLDOWN, WAVE_CLAIM_TIMER, ATTACKER_SPAWN_COOLDOWN];

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

  mem8[loc_c300] = 0;
  mem8[loc_c200] = 0;
  // Cleared only when the primary gate is armed while the secondary one reads clear.
  mem8[SCREEN_UNFLIPPED] = mem8[ACTIVE_PLAYER] !== 0 && mem8[COCKTAIL_MODE] === 0 ? 0 : 1;
  mem8[loc_c302] = mem8[SCREEN_UNFLIPPED];

  mem8[DIP1_MIRROR] = mem8[loc_c200] ^ 0xff;
  mem8[IN0_MIRROR] = mem8[loc_c300] ^ 0xff;
  mem8[IN1_MIRROR] = mem8[loc_c320] ^ 0xff;
  mem8[IN2_MIRROR] = mem8[loc_c340] ^ 0xff;
  mem8[COINAGE_SETTINGS] = mem8[loc_c360] ^ 0xff;

  mem8[FRAME_TICK] = mem8[FRAME_TICK] + 1;

  regs.a = regs.inc8(mem8[BCD_FRAME_COUNTER]);
  regs.daa();
  mem8[BCD_FRAME_COUNTER] = regs.a;

  for (const timer of TIMERS) if (mem8[timer] !== 0) mem8[timer] = mem8[timer] - 1;

  serviceCoinInputs(m);

  regs.a = mem8[SEQUENCE_PHASE] & 0x03;
  regs.hl = loc_015f;
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.push16(loc_0174); // the arm returns here, and the epilogue unwinds from there
  m.call(arm);
  return sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
}
