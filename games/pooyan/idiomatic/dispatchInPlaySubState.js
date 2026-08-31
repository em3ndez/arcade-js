// SPDX-License-Identifier: GPL-3.0-only
import { initRoundArenaAndRestorePlayerBank } from "./initRoundArenaAndRestorePlayerBank.js";
import { selectRoundDisplayListAndAdvancePhase } from "./selectRoundDisplayListAndAdvancePhase.js";
import { startRoundAfterIntroDelay } from "./startRoundAfterIntroDelay.js";
import { spawnEnemyWave } from "./spawnEnemyWave.js";
import { runActiveGameplayFrame } from "./runActiveGameplayFrame.js";
import { stepGameplayFrame } from "./stepGameplayFrame.js";
import { reseedSpawnCountersAndArmPlayMode } from "./reseedSpawnCountersAndArmPlayMode.js";
import { advancePhaseGaugeCountdown } from "./advancePhaseGaugeCountdown.js";
import { rebuildFieldAndLatchPlayStateWithTamperCheck } from "./rebuildFieldAndLatchPlayStateWithTamperCheck.js";
import { floodFieldAndLatchPlayStatePhaseTimer } from "./floodFieldAndLatchPlayStatePhaseTimer.js";
import { dispatchLevelIntroElseMainLoop } from "./dispatchLevelIntroElseMainLoop.js";
import { announceBonusStageAndStartPlay } from "./announceBonusStageAndStartPlay.js";
import { commitPromotedObjectsAndClearHelpScreenOnCountdown } from "./commitPromotedObjectsAndClearHelpScreenOnCountdown.js";
import { saveLivePageToPlayer0Bank } from "./saveLivePageToPlayer0Bank.js";
import { snapshotPlayer1BankWithSignatureCheck } from "./snapshotPlayer1BankWithSignatureCheck.js";
import { advancePlayStateAndStageHighScoreEntryOnTimer } from "./advancePlayStateAndStageHighScoreEntryOnTimer.js";
import { driveObjectsByFrameParityThenBuildSprites } from "./driveObjectsByFrameParityThenBuildSprites.js";
import { dispatchRoundEndElseWipeColumn } from "./dispatchRoundEndElseWipeColumn.js";
import { dispatchBonusStagePhase } from "./dispatchBonusStagePhase.js";
import { PLAY_STATE_INDEX } from "./names.js";
/**
 * dispatchInPlaySubState — in-play sub-state dispatcher. Tail-hands the play-state index (low five bits) to one of
 * nineteen handlers; the handler returns to the caller's seated continuation (a tail dispatch, so no
 * continuation is stacked here). Indices 15/16/17 reach the deep-state handlers (round-2 and beyond);
 * indices 19..31 are guard-slack past the nineteen-entry table and throw.
 * LIVE-OUT: memory only.
 */
export function dispatchInPlaySubState(m) {
  switch (m.mem8[PLAY_STATE_INDEX] & 0x1f) {
    case 0: return initRoundArenaAndRestorePlayerBank(m);
    case 1: return selectRoundDisplayListAndAdvancePhase(m);
    case 2: return startRoundAfterIntroDelay(m);
    case 3: return spawnEnemyWave(m);
    case 4: return runActiveGameplayFrame(m);
    case 5: return stepGameplayFrame(m);
    case 6: return reseedSpawnCountersAndArmPlayMode(m);
    case 7: return advancePhaseGaugeCountdown(m);
    case 8: return rebuildFieldAndLatchPlayStateWithTamperCheck(m);
    case 9: return floodFieldAndLatchPlayStatePhaseTimer(m);
    case 10: return saveLivePageToPlayer0Bank(m);
    case 11: return snapshotPlayer1BankWithSignatureCheck(m);
    case 12: return advancePlayStateAndStageHighScoreEntryOnTimer(m);
    case 13: return driveObjectsByFrameParityThenBuildSprites(m);
    case 14: return dispatchRoundEndElseWipeColumn(m);
    case 18: return dispatchBonusStagePhase(m);
    case 15: return dispatchLevelIntroElseMainLoop(m);
    case 16: return announceBonusStageAndStartPlay(m);
    case 17: return commitPromotedObjectsAndClearHelpScreenOnCountdown(m);
    default:
      throw new Error("dispatchInPlaySubState: play-state index > 18 (guard-slack; the table has 19 entries)");
  }
}
