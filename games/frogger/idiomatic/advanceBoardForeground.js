// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardForeground — the board-advance foreground pass: queue two sound cues, bump the active
 * player's mod-5 difficulty index (wrapping to 0 at 5), reseed the score field and lay out the new
 * board, raise the board-laid-out flag, then tail into the score adder with the board-advance delta.
 * LIVE-OUT: memory-only.
 */
import { ACTIVE_PLAYER, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX, BOARD_ADVANCE_DONE_FLAG, BOARD_ADVANCE_SCORE_DELTA } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { seedObjectAnimationState } from "./seedObjectAnimationState.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const MOD5_WRAP = 5;

export function advanceBoardForeground(m) {
  const { mem8 } = m;

  enqueueSoundCommand(m, 0x10);
  enqueueSoundCommand(m, 0x30);

  const cell = mem8[ACTIVE_PLAYER] === 1 ? PLAYER1_DIFFICULTY_INDEX : PLAYER2_DIFFICULTY_INDEX;
  let v = (mem8[cell] + 1) & 0xff;
  if (v === MOD5_WRAP) v = 0;
  mem8[cell] = v;

  clearAndSeedScoreField(m);
  clearObjectBlocksAndMirrorToObjRam(m);
  loadActivePlayerLaneParams(m);
  seedObjectAnimationState(m);

  mem8[BOARD_ADVANCE_DONE_FLAG] = 1;
  return addScoreAndAwardExtraLife(m, BOARD_ADVANCE_SCORE_DELTA);
}
