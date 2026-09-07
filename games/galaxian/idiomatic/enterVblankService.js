// SPDX-License-Identifier: GPL-3.0-only
// The vblank-NMI service, run once per frame. Ack the interrupt; while the power-on self-test is active run
// that path instead; otherwise DMA the OBJRAM shadow to the sprite/scroll hardware, kick the watchdog, latch
// this frame's inputs with a shifted history, tick the frame counter, run the per-frame service routines,
// dispatch on the game state, and re-arm the interrupt for the next frame.
import { IRQ_ENABLE, SELFTEST_MODE, OBJRAM_HW_BASE, OBJRAM_SHADOW_BASE, WATCHDOG_RESET, FRAME_COUNTER,
  GAME_STATE, IN0, IN1, IN2_PORT, IN0_SHADOW, IN1_SHADOW, IN2_SHADOW, loc_4013, loc_4015, loc_4016 } from "./names.js";
import { dispatchSelfTestMode } from "./dispatchSelfTestMode.js";
import { serviceCoinInputs } from "./serviceCoinInputs.js";
import { tickCoinMeterAndAwardCredits } from "./tickCoinMeterAndAwardCredits.js";
import { updateCoinLockoutFromCredits } from "./updateCoinLockoutFromCredits.js";
import { driveSoundFrame } from "./driveSoundFrame.js";
import { driveSoundLfoLevel } from "./driveSoundLfoLevel.js";
import { advanceMessageScroller } from "./advanceMessageScroller.js";
import { fillScreenThenLatchConfigAndAdvanceState } from "./fillScreenThenLatchConfigAndAdvanceState.js";
import { runAttractSequenceAndAdvanceOnCredit } from "./runAttractSequenceAndAdvanceOnCredit.js";
import { runStartScreenAndLaunchGame } from "./runStartScreenAndLaunchGame.js";
import { runPlayerOnePlayFrame } from "./runPlayerOnePlayFrame.js";
import { runPlayerTwoPlayFrame } from "./runPlayerTwoPlayFrame.js";

// Game-state dispatch table (indexed by GAME_STATE): boot config, attract, start screen, and the two play frames.
const STATE_HANDLERS = [
  fillScreenThenLatchConfigAndAdvanceState,
  runAttractSequenceAndAdvanceOnCredit,
  runStartScreenAndLaunchGame,
  runPlayerOnePlayFrame,
  runPlayerTwoPlayFrame,
];

export function enterVblankService(m) {
  const { mem8, mem16 } = m;
  mem8[IRQ_ENABLE] = 0; // ack the NMI

  const mode = mem8[SELFTEST_MODE];
  if (mode !== 0) {
    dispatchSelfTestMode(m, mode); // power-on self-test path
    mem8[IRQ_ENABLE] = 1; // re-arm for the next frame
    return;
  }

  // DMA the OBJRAM shadow to the sprite/scroll/bullet hardware
  for (let i = 0; i < 0x80; i++) mem8[OBJRAM_HW_BASE + i] = mem8[OBJRAM_SHADOW_BASE + i];
  void mem8[WATCHDOG_RESET]; // kick the watchdog

  // latch this frame's raw inputs, shifting the previous frame's into the history cells first
  mem8[loc_4016] = mem8[loc_4015];
  mem8[loc_4015] = mem8[loc_4013];
  mem16[loc_4013] = mem16[IN0_SHADOW]; // previous IN0/IN1 -> the 1-frame history word
  mem8[IN2_SHADOW] = mem8[IN2_PORT];
  mem8[IN1_SHADOW] = mem8[IN1];
  mem8[IN0_SHADOW] = mem8[IN0];

  // service/test switch -> cold reset; dead on a good run, so a hold is a fail-closed stop here
  if (mem8[IN0_SHADOW] & 0x40) throw new Error("service switch held: cold reset is not modeled in the born-live layer");

  mem8[FRAME_COUNTER] = mem8[FRAME_COUNTER] - 1; // the write truncates to 8 bits (wraps 0 -> 0xff)

  serviceCoinInputs(m);
  tickCoinMeterAndAwardCredits(m);
  updateCoinLockoutFromCredits(m);
  driveSoundFrame(m);
  driveSoundLfoLevel(m);
  advanceMessageScroller(m);

  const handler = STATE_HANDLERS[mem8[GAME_STATE]];
  if (!handler) throw new Error(`no state handler for GAME_STATE=${mem8[GAME_STATE]}`);
  handler(m);

  mem8[IRQ_ENABLE] = 1; // re-arm the NMI for the next frame (the vblank epilogue)
}
