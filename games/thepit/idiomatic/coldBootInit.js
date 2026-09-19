// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldBootInit — power-on cold-boot init: bring the machine up from reset, seed its work RAM,
 * run the one-time screen/table/sound setup, then hand off to the attract flow.
 *
 * Reached only from the reset vector (the very first code after power-on). It switches the
 * per-frame interrupt off and re-seats the stack at the top of work RAM, clears the
 * triple-redundant credit counter and the game-mode byte, seeds the coin/start input debounce
 * state, readies the score, sound and high-score tables and the blank board screen, requests the
 * power-on sound, arms the secondary game-state byte, decodes the cabinet DIP switches into the
 * gameplay-parameter block, holds for a short spell (the frame-wait re-enables the interrupt that
 * paces it), then hands off to the reset/round-restart epilogue, which begins the first attract
 * cycle and never returns here. The credit counter is kept in three copies so a single corrupted
 * byte can be caught; the coin/start switches idle in an alternating-bit pattern seeded here.
 */

import { disableFrameInterrupt } from "./disableFrameInterrupt.js";
import { resetScoreAndSoundQueue } from "./resetScoreAndSoundQueue.js";
import { initScoreDisplay } from "./initScoreDisplay.js";
import { enableSound } from "./enableSound.js";
import { blankScreen } from "./blankScreen.js";
import { setupBoardModeC0 } from "./setupBoardModeC0.js";
import { requestSound2 } from "./requestSound2.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { waitFrames } from "./waitFrames.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";
import {
  GAME_STATE,
  ACTIVE_PLAYER,
  IN1_DEBOUNCED,
  IN1_PREV,
  CREDIT_COUNT,
  CREDIT_MIRROR_A,
  CREDIT_MIRROR_B,
  COIN_SW_ACCUM,
  START1_SW_ACCUM,
  START2_SW_ACCUM,
  STACK_TOP,
} from "./names.js";

export function* coldBootInit(m) {
  const { mem8, regs } = m;

  // Re-seat the stack at the top of work RAM. The frame-wait and the downstream setup
  // screen still return through the machine stack, so this is where their return frames
  // land; every push below is relative to this fresh top.
  regs.sp = STACK_TOP;

  // Switch the per-frame interrupt off while the machine is seeded.
  disableFrameInterrupt(m);

  // Clear the triple-redundant credit counter and the game-mode byte.
  mem8[CREDIT_COUNT] = 0;
  mem8[CREDIT_MIRROR_A] = 0;
  mem8[CREDIT_MIRROR_B] = 0;
  mem8[GAME_STATE] = 0;

  // Prime the coin/start (IN1) input debounce: the latched value and its rolling sample.
  mem8[IN1_DEBOUNCED] = 6;
  mem8[IN1_PREV] = 6;

  // Seed the coin/start switch debounce accumulators to their idle alternating-bit
  // patterns (the two start lines share 0x55; the coin line's is that pattern rotated).
  mem8[START1_SW_ACCUM] = 0x55;
  mem8[START2_SW_ACCUM] = 0x55;
  mem8[COIN_SW_ACCUM] = 0xaa;

  // Ready the score + sound queue, the score/high-score tables, and the sound latch.
  resetScoreAndSoundQueue(m);
  initScoreDisplay(m);
  enableSound(m);

  // Blank the board screen (mode 0), then run the 0xC0 display-setup variant.
  blankScreen(m);
  setupBoardModeC0(m);

  // Play the power-on sound and arm the secondary game-state byte.
  requestSound2(m);
  mem8[ACTIVE_PLAYER] = 1;

  // Decode the cabinet DIP switches into the gameplay-parameter block.
  applyDipSwitches(m);

  // Hold briefly. waitFrames re-enables the per-frame interrupt that ticks its countdown
  // and returns through the work stack, so push the resume slot it pops.
  yield* waitFrames(m, 60);

  // Hand off to the reset/round-restart epilogue and never return here.
  return yield* resetStateAndShowSetup(m);
}
