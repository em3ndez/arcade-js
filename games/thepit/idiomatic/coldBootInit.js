// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldBootInit — power-on cold-boot init: bring the machine up from reset, seed its
 * work RAM, run the one-time screen/table/sound setup, then hand off to the attract
 * flow.  ROM 0x01a4.
 *
 * Reached only from the reset vector (the very first code after power-on). In order it:
 *
 *   1. Switches the per-frame interrupt off and re-seats the stack at the top of work
 *      RAM, so everything below runs uninterrupted with a clean stack.
 *   2. Clears the triple-redundant credit counter and the game-mode byte, seeds the
 *      coin/start input debounce state, and readies the score, sound and high-score
 *      tables and the blank board screen.
 *   3. Requests the power-on sound, arms the secondary game-state byte, and decodes the
 *      cabinet DIP switches into the gameplay-parameter block.
 *   4. Holds for a short spell (the frame-wait re-enables the interrupt that paces it),
 *      then hands off to the reset/round-restart epilogue, which begins the first
 *      attract cycle and never returns here.
 *
 * The credit counter is kept in three copies (0x8000 and its mirrors 0x801c / 0x812c)
 * so a single corrupted byte can be caught; boot clears all three. The coin/start
 * switches are debounced through shift-register accumulator bytes (0x8003 / 0x8004 /
 * 0x8005) whose idle state is an alternating-bit pattern, seeded here. The original
 * also burns a long power-on settle delay in this spot; it touches no memory, so
 * nothing models it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-01a4.test.js.
 * GATE:     crafted-entry — the real reset dispatch is captured from a boot run (the
 *           hook clones the pristine power-on state at 0x01a4), and the still-oracle
 *           reset/entry handler 0x01f9 the tail eventually reaches is stubbed to a
 *           no-op identically on both arms so the otherwise-endless boot cascade
 *           terminates. The frame-waits (this routine's own hold + the epilogue's
 *           setup-screen hold) are driven by one identical per-frame countdown tick
 *           on both sides. RAM diff outside the dead stack-scratch window below the
 *           re-seated stack top; pc/SP/registers excluded per the memory-equivalence
 *           contract. Reached once, at cold boot.
 * LIVE-OUT: memory-only — everything the seed stores, the setup helpers, the DIP
 *           decode and the delegated epilogue leave in work / colour / video / sprite
 *           RAM. Nothing reads a register back: the tail hands off and just propagates
 *           onward into the attract flow.
 * NAMES:    GAME_STATE (0x8001), ACTIVE_PLAYER (0x8002), IN1_DEBOUNCED (0x8015),
 *           IN1_PREV (0x8016), the credit counter CREDIT_COUNT (0x8000) + mirrors
 *           CREDIT_MIRROR_A (0x801c) / CREDIT_MIRROR_B (0x812c), and the coin/start
 *           debounce accumulators COIN_SW_ACCUM (0x8003) / START1_SW_ACCUM (0x8004) /
 *           START2_SW_ACCUM (0x8005), all from names.js.
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
  m.push16(0x01f6);
  yield* waitFrames(m, 60);

  // Hand off to the reset/round-restart epilogue and never return here.
  return yield* resetStateAndShowSetup(m);
}
