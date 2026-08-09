// SPDX-License-Identifier: GPL-3.0-only
/** loc_1323 — run one frame of the phase-14 animation, and only on alternate frames. The phase's
 * own step cell picks the arm: the early steps flash the player ship and advance two character-plane
 * animations, the last step hides every sprite, sets up the active player's turn and winds the outer
 * sequence on to its reload sub-step. LIVE-OUT: memory. */

import { flashPlayerWhiteEveryOtherFrame } from "./flashPlayerWhiteEveryOtherFrame.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { advanceScriptedCharPlaneBandTo2 } from "./advanceScriptedCharPlaneBandTo2.js";
import { loc_1393 } from "./loc_1393.js";
import { loc_13cc } from "./loc_13cc.js";
import { advanceScriptedCharPlaneBandTo4 } from "./advanceScriptedCharPlaneBandTo4.js";
import { loadActivePlayerContextAndPostRoundHud } from "./loadActivePlayerContextAndPostRoundHud.js";
import { FRAME_TICK, SEQUENCE_SUBSTEP, SEQUENCE_DELAY } from "./names.js";

const ANIMATION_STEP = 0xa9f0;
const SUBSTEP_RELOAD = 0x2750;
const WIND_DELAY = 90;

export function loc_1323(m) {
  const { mem8 } = m;
  if (mem8[FRAME_TICK] & 2) return;

  switch (mem8[ANIMATION_STEP]) {
    case 0:
      flashPlayerWhiteEveryOtherFrame(m);
      return;
    case 1:
      flashPlayerWhiteEveryOtherFrame(m);
      advanceScriptedCharPlaneBandTo2(m);
      return;
    case 2:
      loc_1393(m);
      advanceScriptedCharPlaneBandTo4(m);
      return;
    case 3:
      advanceScriptedCharPlaneBandTo4(m);
      return;
    case 4:
      loc_13cc(m);
      return;
    default:
      mem8[SEQUENCE_DELAY] = WIND_DELAY;
      hideAllSprites(m);
      loadActivePlayerContextAndPostRoundHud(m);
      mem8[SEQUENCE_SUBSTEP] = mem8[SUBSTEP_RELOAD];
  }
}
