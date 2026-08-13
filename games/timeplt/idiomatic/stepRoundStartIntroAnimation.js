// SPDX-License-Identifier: GPL-3.0-only
/** stepRoundStartIntroAnimation — run one frame of the phase-14 animation, and only on alternate frames. The phase's
 * own step cell picks the arm: the early steps flash the player ship and advance two character-plane
 * animations, the last step hides every sprite, sets up the active player's turn and winds the outer
 * sequence on to its reload sub-step. LIVE-OUT: memory. */

import { flashPlayerWhiteEveryOtherFrame } from "./flashPlayerWhiteEveryOtherFrame.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { advanceScriptedCharPlaneBandTo2 } from "./advanceScriptedCharPlaneBandTo2.js";
import { cyclePlayerSpriteColourThenAdvanceStepAtZero } from "./cyclePlayerSpriteColourThenAdvanceStepAtZero.js";
import { floodColourPlaneWithSavedPlayerColour } from "./floodColourPlaneWithSavedPlayerColour.js";
import { advanceScriptedCharPlaneBandTo4 } from "./advanceScriptedCharPlaneBandTo4.js";
import { loadActivePlayerContextAndPostRoundHud } from "./loadActivePlayerContextAndPostRoundHud.js";
import { FRAME_TICK, INTRO_ANIMATION_STEP, SEQUENCE_DELAY, SEQUENCE_SUBSTEP, loc_2750 } from "./names.js";

const WIND_DELAY = 90;

export function stepRoundStartIntroAnimation(m) {
  const { mem8 } = m;
  if (mem8[FRAME_TICK] & 2) return;

  switch (mem8[INTRO_ANIMATION_STEP]) {
    case 0:
      flashPlayerWhiteEveryOtherFrame(m);
      return;
    case 1:
      flashPlayerWhiteEveryOtherFrame(m);
      advanceScriptedCharPlaneBandTo2(m);
      return;
    case 2:
      cyclePlayerSpriteColourThenAdvanceStepAtZero(m);
      advanceScriptedCharPlaneBandTo4(m);
      return;
    case 3:
      advanceScriptedCharPlaneBandTo4(m);
      return;
    case 4:
      floodColourPlaneWithSavedPlayerColour(m);
      return;
    default:
      mem8[SEQUENCE_DELAY] = WIND_DELAY;
      hideAllSprites(m);
      loadActivePlayerContextAndPostRoundHud(m);
      mem8[SEQUENCE_SUBSTEP] = mem8[loc_2750];
  }
}
