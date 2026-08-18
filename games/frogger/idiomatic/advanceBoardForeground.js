// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardForeground  —  ROM 0x05f0  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The one-shot "you cleared the board" foreground pass. When all five frogs have reached their home
 *   bays, the machine tears down the finished board and stands a fresh, harder one in its place. This
 *   routine is the visible/front-of-house half of that changeover: it fires the board-advance jingle,
 *   ramps the difficulty one notch, wipes and re-seeds the play field, installs the new board's lane
 *   layout and object animation, marks the board as laid out, and pays out the board-clear bonus.
 *
 * WHERE IT SITS
 *   Fired from the per-frame board-start dispatcher setUpBoardOrContinueLife, which runs it exactly once
 *   per completed board — only while a board-advance is pending (BOARD_ADVANCE_REQUEST 0x826d != 0), and
 *   clears that request immediately afterward so this pass does not repeat. The completion itself is
 *   raised upstream by the goal handler chain (loc_05d3) once the active player's home tally hits 5.
 *
 * LIVE-OUT
 *   Memory only. Every effect is a RAM write or a delegated write inside a callee (sound queue,
 *   difficulty index, score field, object blocks, lane params, animation state, the board-laid flag,
 *   and the score word). It returns nothing the caller reads.
 */
import { ACTIVE_PLAYER, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX, BOARD_ADVANCE_DONE_FLAG, BOARD_ADVANCE_SCORE_DELTA } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { seedObjectAnimationState } from "./seedObjectAnimationState.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

// There are five lane-difficulty tiers (indices 0..4). After the fifth board the index wraps back to
// tier 0 and the machine repeats the ramp — so difficulty cycles rather than climbing forever.
const MOD5_WRAP = 5;

export function advanceBoardForeground(m) {
  const { mem8 } = m;

  // ── Board-advance jingle: two sound-effect command codes ──────────────────────────────
  // enqueueSoundCommand (ROM 0x0018) pushes one sound command onto the sound ring (SOUND_QUEUE_COUNT
  // 0x8300); the audio service drains it later. Codes 0x10 and 0x30 are the two cues that together
  // make up the board-cleared fanfare — queued in order so they play as a pair.
  enqueueSoundCommand(m, 0x10);
  enqueueSoundCommand(m, 0x30);

  // ── Ramp the active player's difficulty one tier, modulo 5 ────────────────────────────
  // The lane layout is chosen by a per-player difficulty index: PLAYER1_DIFFICULTY_INDEX (0x8293) when
  // ACTIVE_PLAYER (0x83fd) holds 1, otherwise PLAYER2_DIFFICULTY_INDEX (0x8294). loadActivePlayerLaneParams
  // (below) uses that index to pick which lane-parameter block to install, so bumping it here is what
  // makes the *next* board harder. Increment the stored index (& 0xff mirrors the Z80's 8-bit register),
  // and when it reaches 5 wrap it back to 0 — cycling through the five tiers 0→1→2→3→4→0→…
  const difficultyIndexCell = mem8[ACTIVE_PLAYER] === 1 ? PLAYER1_DIFFICULTY_INDEX : PLAYER2_DIFFICULTY_INDEX;
  let nextIndex = (mem8[difficultyIndexCell] + 1) & 0xff;
  if (nextIndex === MOD5_WRAP) nextIndex = 0;
  mem8[difficultyIndexCell] = nextIndex;

  // ── Tear down the old board and stand up the new one ──────────────────────────────────
  // clearAndSeedScoreField (ROM 0x0629): reset the active player's work RAM, zero the score-display
  //   cursor pair, and re-blit the blank score field.
  // clearObjectBlocksAndMirrorToObjRam (ROM 0x064b): zero the live object block (LIVE_OBJECT_PAGE 0x800c)
  //   and the second sprite block, mirroring the cleared object head into OBJRAM so the screen agrees.
  // loadActivePlayerLaneParams (ROM 0x223d): follow the (now-bumped) difficulty index through the lane
  //   pointer table and copy the new tier's 33-byte lane-parameter block into ACTIVE_LANE_PARAM_BLOCK.
  // seedObjectAnimationState (ROM 0x1a02): re-seed the object-animation cells from their fixed tables so
  //   the new board's cars/logs/turtles start from their canonical animation phases.
  clearAndSeedScoreField(m);
  clearObjectBlocksAndMirrorToObjRam(m);
  loadActivePlayerLaneParams(m);
  seedObjectAnimationState(m);

  // ── Latch "board laid out", then pay the board-clear bonus ────────────────────────────
  // BOARD_ADVANCE_DONE_FLAG (0x8380) = 1 tells the per-frame service routine the fresh board is fully in
  // place (it gates the reveal-strip blit and status-row redraw). Then tail into addScoreAndAwardExtraLife
  // (ROM 0x08e0) with BOARD_ADVANCE_SCORE_DELTA (0x0100 = 100 points, packed BCD): it adds the delta to the
  // active player's score word and, if this pushes the score across the extra-life target, awards the bonus.
  mem8[BOARD_ADVANCE_DONE_FLAG] = 1;
  return addScoreAndAwardExtraLife(m, BOARD_ADVANCE_SCORE_DELTA);
}
