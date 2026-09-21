// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchIntroCutsceneStep — run the current step of the opening Kong-climb cutscene: hand the
 * frame to the handler for the step held in INTRO_STEP, a direct HANDLERS lookup by the selector.
 *
 * LIVE-OUT: memory-only — the step handler's writes.
 */

import { INTRO_STEP } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { setupIntroCutsceneStep } from "./setupIntroCutsceneStep.js";
import { runIntroClimbStep } from "./runIntroClimbStep.js";
import { animateIntroClimbStep } from "./animateIntroClimbStep.js";
import { advanceSequenceStepWhenTimerExpires } from "./advanceSequenceStepWhenTimerExpires.js";
import { loc_0b06 } from "./loc_0b06.js";
import { loc_0b68 } from "./loc_0b68.js";
import { runIntroRoarStep } from "./runIntroRoarStep.js";

const HANDLERS = [
  setupIntroCutsceneStep, // step 0 — set up the cutscene
  runIntroClimbStep, // step 1 — Kong's climb
  animateIntroClimbStep, // step 2 — climb animation
  advanceSequenceStepWhenTimerExpires, // step 3 — gated tick, advance on expiry
  loc_0b06, // step 4 — reseed for the next phase
  advanceSequenceStepWhenTimerExpires, // step 5 — gated tick (same handler as step 3)
  loc_0b68, // step 6 — scroll the sprite block, place board bands
  runIntroRoarStep, // step 7 — the roar
];

export function dispatchIntroCutsceneStep(m) {
  const handler = HANDLERS[m.mem8[INTRO_STEP]];
  if (handler) return handler(m);

  throw new NotImplemented(
    `dispatchIntroCutsceneStep: INTRO_STEP ${m.mem8[INTRO_STEP]} has no handler.`,
  );
}
