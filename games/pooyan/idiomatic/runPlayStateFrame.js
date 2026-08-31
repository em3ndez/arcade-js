// SPDX-License-Identifier: GPL-3.0-only
import { tickActivePlayerPlayTimer } from "./tickActivePlayerPlayTimer.js";
import { resetToBoardBuildToContinuePlay } from "./resetToBoardBuildToContinuePlay.js";
import { dispatchInPlaySubState } from "./dispatchInPlaySubState.js";
/**
 * runPlayStateFrame — top-level game state-3 (play) handler, dispatched each frame from the NMI
 * service via the state table. Ticks the BCD play-timer, then dispatches the in-play sub-state through
 * the frozen rst-0x28 dispatcher with the continuation seated in HL: the selected
 * handler returns to the post-dispatch continuation, which runs and returns to the NMI epilogue.
 * LIVE-OUT: none — a per-frame state handler returning into the NMI service.
 */

export function runPlayStateFrame(m) {
  tickActivePlayerPlayTimer(m); // tick the BCD play-timer
  dispatchInPlaySubState(m); // in-play sub-state dispatch (tail dispatch; the handler returns here)
  return resetToBoardBuildToContinuePlay(m); // post-dispatch continuation -> NMI epilogue
}
