// SPDX-License-Identifier: GPL-3.0-only
import { loc_1601 } from "./loc_1601.js";
import { selectRoundDisplayListAndAdvancePhase } from "./selectRoundDisplayListAndAdvancePhase.js";
import { startRoundAfterIntroDelay } from "./startRoundAfterIntroDelay.js";
import { spawnEnemyWave } from "./spawnEnemyWave.js";
import { runActiveGameplayFrame } from "./runActiveGameplayFrame.js";
import { stepGameplayFrame } from "./stepGameplayFrame.js";
import { reseedSpawnCountersAndArmPlayMode } from "./reseedSpawnCountersAndArmPlayMode.js";
import { advancePhaseGaugeCountdown } from "./advancePhaseGaugeCountdown.js";
import { loc_1b43 } from "./loc_1b43.js";
import { loc_1b8c } from "./loc_1b8c.js";
import { loc_1d9c } from "./loc_1d9c.js";
import { loc_1d6e } from "./loc_1d6e.js";
import { loc_6bb2 } from "./loc_6bb2.js";
import { saveLivePageToPlayer0Bank } from "./saveLivePageToPlayer0Bank.js";
import { loc_1bcc } from "./loc_1bcc.js";
import { advancePlayStateAndStageHighScoreEntryOnTimer } from "./advancePlayStateAndStageHighScoreEntryOnTimer.js";
import { loc_1c53 } from "./loc_1c53.js";
import { dispatchRoundEndElseWipeColumn } from "./dispatchRoundEndElseWipeColumn.js";
import { loc_71b9 } from "./loc_71b9.js";
import { PLAY_STATE_INDEX } from "./names.js";
/**
 * loc_15a1 — in-play sub-state dispatcher. Tail-hands the play-state index (low five bits) to one of
 * nineteen handlers; the handler returns to the caller's seated continuation (a tail dispatch, so no
 * continuation is stacked here). Indices 15/16/17 reach the deep-state handlers (round-2 and beyond);
 * indices 19..31 are guard-slack past the nineteen-entry table and throw.
 * LIVE-OUT: memory only.
 */
export function loc_15a1(m) {
  switch (m.mem8[PLAY_STATE_INDEX] & 0x1f) {
    case 0: return loc_1601(m);
    case 1: return selectRoundDisplayListAndAdvancePhase(m);
    case 2: return startRoundAfterIntroDelay(m);
    case 3: return spawnEnemyWave(m);
    case 4: return runActiveGameplayFrame(m);
    case 5: return stepGameplayFrame(m);
    case 6: return reseedSpawnCountersAndArmPlayMode(m);
    case 7: return advancePhaseGaugeCountdown(m);
    case 8: return loc_1b43(m);
    case 9: return loc_1b8c(m);
    case 10: return saveLivePageToPlayer0Bank(m);
    case 11: return loc_1bcc(m);
    case 12: return advancePlayStateAndStageHighScoreEntryOnTimer(m);
    case 13: return loc_1c53(m);
    case 14: return dispatchRoundEndElseWipeColumn(m);
    case 18: return loc_71b9(m);
    case 15: return loc_1d9c(m);
    case 16: return loc_1d6e(m);
    case 17: return loc_6bb2(m);
    default:
      throw new Error("loc_15a1: play-state index > 18 (guard-slack; the table has 19 entries)");
  }
}
