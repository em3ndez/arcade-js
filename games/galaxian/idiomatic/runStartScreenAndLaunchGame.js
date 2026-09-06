// SPDX-License-Identifier: GPL-3.0-only
// Top-level game-state handler: run the per-frame formation prep, dispatch on the sequence-state selector
// to one of four sub-state handlers, then finish at the start-button round launcher (the pushed post-
// dispatch continuation). The selector only ever holds 0..3 in this state, so a four-arm switch covers it;
// any out-of-range value no-ops the switch and still runs the continuation.
import { advanceFormationSweepOscillator } from "./advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "./summarizeFormationOccupancy.js";
import { resetObjectRamAndAdvanceSequence } from "./resetObjectRamAndAdvanceSequence.js";
import { holdStartLampsThenAdvanceSequence } from "./holdStartLampsThenAdvanceSequence.js";
import { blankVramRowsThenDriveStartLamps } from "./blankVramRowsThenDriveStartLamps.js";
import { driveStartButtonLamps } from "./driveStartButtonLamps.js";
import { beginGameOnStartButton } from "./beginGameOnStartButton.js";
import { SEQUENCE_STATE } from "./names.js";

export function runStartScreenAndLaunchGame(m) {
  advanceFormationSweepOscillator(m);
  summarizeFormationOccupancy(m);

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

  return beginGameOnStartButton(m);
}
