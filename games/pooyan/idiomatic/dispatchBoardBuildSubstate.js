// SPDX-License-Identifier: GPL-3.0-only
import { PLAY_STATE_INDEX } from "./names.js";
import { primeTileFillCursorAndAdvanceBoardBuild } from "./primeTileFillCursorAndAdvanceBoardBuild.js";
import { fillIntroRowsThenBuildBoardIntro } from "./fillIntroRowsThenBuildBoardIntro.js";
import { queueCreditDisplayAndEnterBoardBuild } from "./queueCreditDisplayAndEnterBoardBuild.js";
import { startSelectedPlayerGameConsumingCredits } from "./startSelectedPlayerGameConsumingCredits.js";

/**
 * dispatchBoardBuildSubstate — board-build state dispatcher (NMI epilogue path).
 *
 * Runs the handler for the current play-state index (three states), then runs the shared post-dispatch
 * continuation, which returns to the caller. LIVE-OUT: memory only.
 */
export function dispatchBoardBuildSubstate(m) {
  switch (m.mem8[PLAY_STATE_INDEX]) {
    case 0: primeTileFillCursorAndAdvanceBoardBuild(m); break;
    case 1: fillIntroRowsThenBuildBoardIntro(m); break;
    case 2: queueCreditDisplayAndEnterBoardBuild(m); break;
  }
  return startSelectedPlayerGameConsumingCredits(m);
}
