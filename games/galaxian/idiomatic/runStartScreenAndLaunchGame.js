// SPDX-License-Identifier: GPL-3.0-only
/**
 * runStartScreenAndLaunchGame — the game-state-2 "press start" handler.
 *
 * WHAT IT IS
 *   The top-level handler for game-state 2, the post-credit start screen. Each frame it runs the shared
 *   formation prep, dispatches on the sequence-state selector SEQUENCE_STATE (0x400a) to one of four start-
 *   screen sub-handlers, then tail-runs the start-button round launcher.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x03f2. Reached once a credit is present (advanceGameStateOnCredit leaves the attract state). The
 *   four sub-states set up object RAM, hold the start-button lamps in step with the credit count while a
 *   countdown runs, blank the screen, and finally poll the start buttons — after which beginGameOnStartButton
 *   launches a 1- or 2-player game on a start press. SEQUENCE_STATE only ever holds 0..3 in this state, so a
 *   four-arm switch covers it; an out-of-range value simply no-ops the switch and still runs the launcher
 *   continuation (which the Z80 form always reaches as the pushed post-dispatch return).
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory/VRAM/hardware only (whatever the selected sub-handler and the launcher touch); no
 * register result the caller reads.
 */
// Per-frame formation prep, run before the dispatch: advance the formation sweep oscillator and rebuild
// the row/column occupancy summary the sub-handlers and collision code read.
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
// Sub-state 0: seed the OBJRAM shadow from ROM, zero the sprite/object records, and arm the dwell.
import { resetObjectRamAndAdvanceSequence } from "./resetObjectRamAndAdvanceSequence.js";
// Sub-state 1: tick the countdown, holding the start-button lamps in step with credits until it expires.
import { holdStartLampsThenAdvanceSequence } from "./holdStartLampsThenAdvanceSequence.js";
// Sub-state 2: blank two VRAM rows through the fill cursor, then drive the start-button lamps.
import { blankVramRowsThenDriveStartLamps } from "./blankVramRowsThenDriveStartLamps.js";
// Sub-state 3: drive the two start-button lamp latches (0x6000/0x6001) from the credit count.
import { driveStartButtonLamps } from "./driveStartButtonLamps.js";
// Post-dispatch continuation: launch a 1-player game on IN1 bit0, or a 2-player game on bit1 with >=2 credits.
import { beginGameOnStartButton } from "./beginGameOnStartButton.js";
import { SEQUENCE_STATE } from "./names.js";

export function runStartScreenAndLaunchGame(m) {
  // Shared per-frame formation prep, run for every sub-state.
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

  // Dispatch on the current sequence step to the matching start-screen sub-handler.
  switch (m.mem8[SEQUENCE_STATE]) {
    case 0:
      resetObjectRamAndAdvanceSequence(m);
      break;
    case 1:
      holdStartLampsThenAdvanceSequence(m);
      break;
    case 2:
      blankVramRowsThenDriveStartLamps(m);
      break;
    case 3:
      driveStartButtonLamps(m);
      break;
  }

  // Always finish by polling the start buttons; a press here launches the game and leaves this state.
  return beginGameOnStartButton(m);
}
