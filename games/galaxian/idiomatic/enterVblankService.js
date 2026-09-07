// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterVblankService -- the vertical-blank (NMI) interrupt body, run once per displayed frame.
 *
 * WHAT IT IS
 *   The machine's heartbeat. It fires on every vblank and is the code that pushes the frame's graphics to
 *   hardware, samples the controls with a rolling history, ticks the frame counter, runs the standing
 *   per-frame services, and hands the frame to whichever top-level game-state handler is in charge. In the
 *   born-live engine it is pure JS fired directly by machine.js fireNmi -- no guest register push/pop and
 *   no interrupt stack, so the ROM's register-save prologue and the shared epilogue
 *   rearmVblankInterruptAndRestoreRegs collapse to plain entry and the trailing IRQ re-arm below.
 *
 * ROLE IN THE MACHINE
 *   Acknowledge the interrupt by clearing the IRQ enable latch (0x7001); re-arming for the NEXT frame is
 *   deferred to the very end and is the single write that keeps the heartbeat alive. A mode flag
 *   SELFTEST_MODE (0x401a) forks the frame: nonzero diverts the whole frame to dispatchSelfTestMode (the
 *   boot self-test / screen-fill path) and re-arms; zero takes the main path. The main path DMAs the
 *   128-byte OBJRAM shadow (0x4020) up to the sprite/scroll/bullet hardware (0x5800), pets the watchdog
 *   (a read of 0x7800), latches the three input ports into their shadows behind a two-frame history chain,
 *   bails to a cold reset on the service/test switch (IN0 bit 6), decrements FRAME_COUNTER (0x425f), runs
 *   the fixed six-service roster, and dispatches GAME_STATE (0x4005) through the five-entry handler table.
 *
 * ROM 0x0066 (wired via machine.js fireNmi; documented in mechanisms.md "One frame: the vblank
 *   interrupt"). Grounding: the cells it touches are tagged in names.js -- SELFTEST_MODE, OBJRAM_HW_BASE,
 *   OBJRAM_SHADOW_BASE, FRAME_COUNTER, GAME_STATE, the IN* ports/shadows, IRQ_ENABLE and WATCHDOG_RESET
 *   are all [seen].
 *
 * LIVE-OUT: mem8/mem16 (hardware DMA, input shadows + history, FRAME_COUNTER, and every effect of the
 * services and the dispatched state handler) plus the re-armed IRQ latch. No register result.
 */
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
// The dispatcher below reads GAME_STATE (0x4005) and runs exactly one of these each frame; it mirrors the
// ROM's inline five-entry jump table at 0x0066.
const STATE_HANDLERS = [
  fillScreenThenLatchConfigAndAdvanceState,
  runAttractSequenceAndAdvanceOnCredit,
  runStartScreenAndLaunchGame,
  runPlayerOnePlayFrame,
  runPlayerTwoPlayFrame,
];

export function enterVblankService(m) {
  const { mem8, mem16 } = m;
  // Acknowledge the interrupt by clearing the hardware enable latch; the re-arm for next frame is at the end.
  mem8[IRQ_ENABLE] = 0; // ack the NMI

  // Fork on the self-test mode flag (0x401a): nonzero diverts the whole frame to the boot self-test /
  // screen-fill path, which does its focused job and re-arms the interrupt itself here.
  const mode = mem8[SELFTEST_MODE];
  if (mode !== 0) {
    dispatchSelfTestMode(m, mode); // power-on self-test path
    mem8[IRQ_ENABLE] = 1; // re-arm for the next frame
    return;
  }

  // Graphics hand-off: copy 128 bytes of the composed object shadow up to the sprite/scroll/bullet
  // hardware. This one block-copy at the top of the frame is what actually makes last frame's sprites appear.
  // DMA the OBJRAM shadow to the sprite/scroll/bullet hardware
  for (let i = 0; i < 0x80; i++) mem8[OBJRAM_HW_BASE + i] = mem8[OBJRAM_SHADOW_BASE + i];
  // Pet the watchdog (a read of port 0x7800) to promise the hardware the program is still alive.
  void mem8[WATCHDOG_RESET]; // kick the watchdog

  // Latch the controls with a two-frame history: first shift the older readings down the holding chain
  // (0x4013 -> 0x4015 -> 0x4016), then fold the previous frame's IN0/IN1 shadow word into 0x4013/0x4014,
  // and finally read the three fresh ports into their shadows -- so downstream code can see edges, not just levels.
  // latch this frame's raw inputs, shifting the previous frame's into the history cells first
  mem8[loc_4016] = mem8[loc_4015];
  mem8[loc_4015] = mem8[loc_4013];
  mem16[loc_4013] = mem16[IN0_SHADOW]; // previous IN0/IN1 -> the 1-frame history word
  mem8[IN2_SHADOW] = mem8[IN2_PORT];
  mem8[IN1_SHADOW] = mem8[IN1];
  mem8[IN0_SHADOW] = mem8[IN0];

  // IN0 bit 6 is the service/test switch. In the ROM a hold jumps to the cold-reset vector 0x0000; that
  // path is not modeled in the born-live layer, so a hold is a fail-closed stop here rather than a silent no-op.
  // service/test switch -> cold reset; dead on a good run, so a hold is a fail-closed stop here
  if (mem8[IN0_SHADOW] & 0x40) throw new Error("service switch held: cold reset is not modeled in the born-live layer");

  // Tick the free-running frame counter (its low nibble paces the object-grid redraw; other bits gate periodic work).
  mem8[FRAME_COUNTER] = mem8[FRAME_COUNTER] - 1; // the write truncates to 8 bits (wraps 0 -> 0xff)

  // The fixed six-service roster, in this order every frame regardless of game state: coin/credit front-end,
  // coin-meter/credit award, coin lockout, the two sound drivers, and the scrolling-text stepper.
  serviceCoinInputs(m);
  tickCoinMeterAndAwardCredits(m);
  updateCoinLockoutFromCredits(m);
  driveSoundFrame(m);
  driveSoundLfoLevel(m);
  advanceMessageScroller(m);

  // Hand the frame to exactly one top-level state handler selected by GAME_STATE (0x4005). An index with
  // no handler is a hard error rather than a silent skip.
  const handler = STATE_HANDLERS[mem8[GAME_STATE]];
  if (!handler) throw new Error(`no state handler for GAME_STATE=${mem8[GAME_STATE]}`);
  handler(m);

  // Re-arm the enable latch so the interrupt fires again next frame; this is the single write that keeps
  // the heartbeat going.
  mem8[IRQ_ENABLE] = 1; // re-arm the NMI for the next frame (the vblank epilogue)
}
