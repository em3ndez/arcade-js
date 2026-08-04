// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetBoardInterludeFrame — run the effect-sprite state machine, then dispatch the
 * board-render sequence step.
 *
 * The rivet board's arm of the board-cleared interlude. It does two independent things in order,
 * one after the other:
 *
 *   1. Run the effect-sprite state machine one frame — a four-way router on EFFECT_STATE that
 *      either idles, arms/spawns the effect, or counts it down.
 *   2. Dispatch the rivet-board interlude sequence to its current-step handler: read
 *      BOARD_ADVANCE_STEP and vector to the handler that paints or animates this step.
 *
 * The two callees each read their own inputs straight from memory, so nothing is threaded between
 * them here — this routine just chains the two calls. Nothing at this level consumes a return
 * value, so it is void.
 *
 * The name claims nothing about what the rivet-board interlude LOOKS like: the collapse / fall /
 * reunion reading of its steps belongs to the step handlers, not here.
 *
 * LIVE-OUT: memory-only — no caller reads a register or the return value on the way out.
 */

import { dispatchEffectState } from "./dispatchEffectState.js";
import { dispatchRivetBoardInterludeStep } from "./dispatchRivetBoardInterludeStep.js";

export function runRivetBoardInterludeFrame(m) {
  // Run the effect-sprite state machine one frame.
  dispatchEffectState(m);

  // Dispatch the interlude sequence to its current-step handler.
  dispatchRivetBoardInterludeStep(m);
}
