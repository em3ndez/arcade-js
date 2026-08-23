// SPDX-License-Identifier: GPL-3.0-only
import { loc_7912 } from "./loc_7912.js";
import { resetToBoardBuildToContinuePlay } from "./resetToBoardBuildToContinuePlay.js";
/**
 * runPlayStateFrame — top-level game state-3 (play) handler, dispatched each frame from the NMI
 * service via the state table. Ticks the BCD play-timer, then dispatches the in-play sub-state through
 * the frozen rst-0x28 dispatcher with the continuation seated in HL: the selected
 * handler returns to the post-dispatch continuation, which runs and returns to the NMI epilogue.
 * LIVE-OUT: none — a per-frame state handler returning into the NMI service.
 */

export function runPlayStateFrame(m) {
  loc_7912(m); // tick the BCD play-timer
  m.regs.hl = 0x15d1; // continuation the dispatched handler returns to (bridge to the frozen dispatch)
  m.call(0x15a1); // frozen rst-0x28 in-play sub-state dispatch; the handler returns to the continuation
  return resetToBoardBuildToContinuePlay(m); // post-dispatch continuation -> NMI epilogue
}
