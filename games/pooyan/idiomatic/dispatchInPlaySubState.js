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
 * dispatchInPlaySubState — WHAT IT IS: the in-play sub-state dispatcher, the second of the
 * two nested state machines that shape a frame while a game is actually being played.
 *
 * ROLE IN THE MACHINE: once the top-level game-state selector MAIN_GAME_STATE (0x8805)
 * sits at value 3 (a game is in progress), the per-frame play handler runs this dispatcher
 * every frame. It reads the in-play sub-state index PLAY_STATE_INDEX (0x880a), keeps only
 * its low five bits, and hands the whole frame to exactly one of nineteen handlers — the
 * same word-address jump table that lives at ROM 0x15a8. Each handler owns one slice of a
 * round's life: the setup phases paint the arena and seed the enemy wave, the play phases
 * run the active gameplay frame and drain the phase gauge, and the teardown phases snapshot
 * the player bank, stage a high-score entry, and settle round-clear / game-over /
 * player-swap. A handler advances the round by writing the NEXT index into PLAY_STATE_INDEX
 * before it returns, so the ordered indices below are the shape of a round as it plays out.
 *
 * ROM ADDRESS: 0x15a1 (the jump table it selects from begins at 0x15a8).
 * Grounding: [seen]
 * LIVE-OUT: memory only — the dispatcher writes nothing of its own; the one handler it
 * selects mutates game state and returns straight through to whatever ran the play frame.
 *
 * Indices 15/16/17 are the deep-state handlers (level-intro and bonus-stage arming) that a
 * round only reaches from round two onward. The live table ends at index 18; an index of
 * 19..31 (the five-bit mask can name one, but the round machine never parks the sub-state
 * there) is guard-slack past the table and trips the throw below.
 */
export function dispatchInPlaySubState(m) {
  // Read the in-play sub-state index PLAY_STATE_INDEX (0x880a) and mask to its low five
  // bits — the value the round machine walks through as a round advances. That masked
  // index selects one entry from the ROM 0x15a8 jump table; whichever handler it names runs
  // this frame's slice of the round and returns.
  switch (m.mem8[PLAY_STATE_INDEX] & 0x1f) {
    // Indices 0–3 — round setup, one handler per frame so the screen paint and the actor
    // seeding are spread across several frames rather than done in one burst: init the
    // arena and restore the active player's saved bank, pick the playfield display list,
    // hold through the intro delay, then seed and spawn the enemy wave.
    case 0: return initRoundArenaAndRestorePlayerBank(m);
    case 1: return selectRoundDisplayListAndAdvancePhase(m);
    case 2: return startRoundAfterIntroDelay(m);
    case 3: return spawnEnemyWave(m);
    // Indices 4–7 — active play: the main gameplay frame (index 4) and its lighter sibling
    // (index 5), the reseed of the spawn counters that arms the play-mode latch (index 6),
    // and the phase-gauge drain (index 7) that ends a phase when the gauge reaches zero.
    case 4: return runActiveGameplayFrame(m);
    case 5: return stepGameplayFrame(m);
    case 6: return reseedSpawnCountersAndArmPlayMode(m);
    case 7: return advancePhaseGaugeCountdown(m);
    // Indices 8–14 — teardown and the between-life housekeeping: the two screen-clear
    // rebuilds (8/9, each guarding a ROM/field integrity check as it latches the next play
    // state), the two per-player bank snapshots (10 saves player 0's page, 11 saves
    // player 1's behind a signature tripwire), the high-score-entry staging (12), the
    // per-frame object driver that builds the sprites (13), and the round-end master that
    // resolves round-clear / game-over / player-swap or else wipes a column (14).
    case 8: return rebuildFieldAndLatchPlayStateWithTamperCheck(m);
    case 9: return floodFieldAndLatchPlayStatePhaseTimer(m);
    case 10: return saveLivePageToPlayer0Bank(m);
    case 11: return snapshotPlayer1BankWithSignatureCheck(m);
    case 12: return advancePlayStateAndStageHighScoreEntryOnTimer(m);
    case 13: return driveObjectsByFrameParityThenBuildSprites(m);
    case 14: return dispatchRoundEndElseWipeColumn(m);
    // Index 18 — the bonus / eagle-stage phase dispatcher, a nested dispatch level of its
    // own that steps the bonus stage through its phases.
    case 18: return dispatchBonusStagePhase(m);
    // Indices 15–17 — the deep-round states reached from round two onward: the round-parity
    // gate that steers into either the level-intro sequence or the main-loop dispatch (15),
    // the bonus-stage arming countdown that announces the stage and starts play (16), and
    // the commit of promoted objects that also clears the help screen on its countdown (17).
    case 15: return dispatchLevelIntroElseMainLoop(m);
    case 16: return announceBonusStageAndStartPlay(m);
    case 17: return commitPromotedObjectsAndClearHelpScreenOnCountdown(m);
    // Indices 19..31 are guard-slack: the five-bit mask can produce them, but the round
    // machine never leaves the sub-state parked there, so reaching one means PLAY_STATE_INDEX
    // has been corrupted past the 19-entry table — fail loud rather than run off its end.
    default:
      throw new Error("dispatchInPlaySubState: play-state index > 18 (guard-slack; the table has 19 entries)");
  }
}
