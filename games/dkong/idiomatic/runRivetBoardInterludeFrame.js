// SPDX-License-Identifier: GPL-3.0-only
// runRivetBoardInterludeFrame: run the effect-sprite state machine one frame, then dispatch the
// rivet-board interlude sequence to its current-step handler. Memory-only; chains two calls.

import { dispatchRivetBoardInterludeStep } from "./dispatchRivetBoardInterludeStep.js";
import { dispatchEffectState } from "./dispatchEffectState.js";

export function runRivetBoardInterludeFrame(m) {
  dispatchEffectState(m);

  dispatchRivetBoardInterludeStep(m);
}
