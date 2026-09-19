// SPDX-License-Identifier: GPL-3.0-only
// runRivetBoardInterludeFrame: run the effect-sprite state machine one frame, then dispatch the
// rivet-board interlude sequence to its current-step handler. Memory-only; chains two calls.

import { dispatchRivetBoardInterludeStep } from "./dispatchRivetBoardInterludeStep.js";
import { RIVET_RESUME_AFTER_EFFECT } from "./names.js";

const EFFECT_STATE_MACHINE = 0x1dbd;
export function runRivetBoardInterludeFrame(m) {
  // Dispatch by address so the effect machine's arm/countdown handlers' guest `ret` pops the
  // bracket pushed here; a plain call left it unbalancing the guest stack (the barrel-jump reset).
  m.push16(RIVET_RESUME_AFTER_EFFECT);
  m.call(EFFECT_STATE_MACHINE);

  dispatchRivetBoardInterludeStep(m);
}
