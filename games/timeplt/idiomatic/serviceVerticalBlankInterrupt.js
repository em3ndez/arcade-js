// SPDX-License-Identifier: GPL-3.0-only
/** serviceVerticalBlankInterrupt — the vertical-blank service, the game's per-frame heartbeat. Refresh
 * the sprite banks and the deferred-cell lists, disarm the interrupt line and kick the watchdog, settle
 * the flip-screen line, latch the five inverted input/dip ports, step the frame and packed-decimal
 * counters, wind three timers down toward zero, service the coin inputs, then run one arm of the
 * sequence machine — the one the low two bits of the sequence phase select — and close the frame.
 * In the original the service stacks both register banks on entry and unstacks them on exit so the
 * interrupted code resumes undisturbed; that bracket holds no game state, so it is not represented.
 * LIVE-OUT: memory, the control latches, and what the sound send leaves latched. */

import { u8 } from "../../../core/int.js";
import { publishSpriteShadow } from "./publishSpriteShadow.js";
import { drainBothDeferredCellLists } from "./drainBothDeferredCellLists.js";
import { serviceCoinInputs } from "./serviceCoinInputs.js";
import { dispatchSequencePhase0SubStepArm } from "./dispatchSequencePhase0SubStepArm.js";
import { dispatchSequencePhase1SubStepArm } from "./dispatchSequencePhase1SubStepArm.js";
import { dispatchSequencePhase2SubStepArm } from "./dispatchSequencePhase2SubStepArm.js";
import { dispatchSequenceSubStepArm } from "./dispatchSequenceSubStepArm.js";
import { sendOneQueuedSoundThenUnwindTheFrameInterrupt } from "./sendOneQueuedSoundThenUnwindTheFrameInterrupt.js";
import { ACTIVE_PLAYER, ATTACKER_SPAWN_COOLDOWN, BANK_LAUNCH_COOLDOWN, BCD_FRAME_COUNTER, COCKTAIL_MODE, COINAGE_SETTINGS, DIP1_MIRROR, FRAME_TICK, IN0_MIRROR, IN1_MIRROR, IN2_MIRROR, SCREEN_UNFLIPPED, SEQUENCE_PHASE, WAVE_CLAIM_TIMER, WATCHDOG_RESET, DSW1_PORT, NMI_ENABLE_LATCH, IN0_PORT, FLIPSCREEN_LATCH, IN1_PORT, IN2_PORT, DSW0_PORT } from "./names.js";

const TIMERS = [BANK_LAUNCH_COOLDOWN, WAVE_CLAIM_TIMER, ATTACKER_SPAWN_COOLDOWN];
const PHASE_MASK = 0x03;

/** One step of a two-digit packed-decimal counter: 09 -> 10, 99 -> 00. The original does `inc a` then `daa`
 *  with the carry flag clear (the `and a` a few instructions earlier clears it and nothing between
 *  sets it), so a digit that reaches ten carries into the next and the pair wraps at one hundred. The
 *  arithmetic is the CPU's exactly, including for a byte that is not valid decimal, where the
 *  correction follows the same rule the adjust instruction applies. */
export function nextPackedDecimalCount(count) {
  const bumped = u8(count + 1);
  const low = bumped & 0x0f;
  const lowCarried = low === 0; // the increment carried out of the low digit
  const lowFix = lowCarried || low > 9 ? 0x06 : 0;
  const highFix = bumped > 0x99 ? 0x60 : 0;
  return u8(bumped + lowFix + highFix);
}

export function serviceVerticalBlankInterrupt(m) {
  const { mem8 } = m;

  publishSpriteShadow(m);
  drainBothDeferredCellLists(m);

  mem8[NMI_ENABLE_LATCH] = 0;
  mem8[WATCHDOG_RESET] = 0;
  // Cleared only when the primary gate is armed while the secondary one reads clear.
  mem8[SCREEN_UNFLIPPED] = mem8[ACTIVE_PLAYER] !== 0 && mem8[COCKTAIL_MODE] === 0 ? 0 : 1;
  mem8[FLIPSCREEN_LATCH] = mem8[SCREEN_UNFLIPPED];

  mem8[DIP1_MIRROR] = mem8[DSW1_PORT] ^ 0xff;
  mem8[IN0_MIRROR] = mem8[IN0_PORT] ^ 0xff;
  mem8[IN1_MIRROR] = mem8[IN1_PORT] ^ 0xff;
  mem8[IN2_MIRROR] = mem8[IN2_PORT] ^ 0xff;
  mem8[COINAGE_SETTINGS] = mem8[DSW0_PORT] ^ 0xff;

  mem8[FRAME_TICK] = mem8[FRAME_TICK] + 1;
  mem8[BCD_FRAME_COUNTER] = nextPackedDecimalCount(mem8[BCD_FRAME_COUNTER]);

  for (const timer of TIMERS) if (mem8[timer] !== 0) mem8[timer] = mem8[timer] - 1;

  serviceCoinInputs(m);

  // The sequence machine's outer level: the low two bits of the phase pick one of four arms, each the
  // literal target its slot of the inline four-word table holds.
  switch (mem8[SEQUENCE_PHASE] & PHASE_MASK) {
    case 0: dispatchSequencePhase0SubStepArm(m); break;
    case 1: dispatchSequencePhase1SubStepArm(m); break;
    case 2: dispatchSequencePhase2SubStepArm(m); break;
    case 3: dispatchSequenceSubStepArm(m); break;
  }

  sendOneQueuedSoundThenUnwindTheFrameInterrupt(m);
}
