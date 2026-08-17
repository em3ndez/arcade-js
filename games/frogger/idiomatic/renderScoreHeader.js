// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreHeader — redraw the three-column score header each frame: the HI-SCORE column (its label
 * then the high score), the 1-UP column (a "1" digit, the shared "-UP" strip, then player 1's score),
 * and — only in two-player mode — the 2-UP column (a "2" digit, "-UP", then player 2's score).
 * LIVE-OUT: memory-only (score-header tilemap cells).
 */
import { HIGH_SCORE, PLAYER1_SCORE, PLAYER2_SCORE, NUM_PLAYERS, HI_SCORE_LABEL_STRIP, UP_LABEL_STRIP } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreField } from "./writeScoreField.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

const HISCORE_LABEL_DST = 0xaa60;
const HISCORE_VALUE_DST = 0xaa41;
const P1_DIGIT_DST = 0xab20;
const P1_SCORE_DST = 0xab41;
const P2_DIGIT_DST = 0xa900;
const P2_SCORE_DST = 0xa921;

const HISCORE_LABEL_LEN = 8;
const SIDE_LABEL_LEN = 3;
const ONE_PLAYER = 1;

export function renderScoreHeader(m) {
  const { mem8, mem16 } = m;

  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HI_SCORE_LABEL_STRIP, HISCORE_LABEL_LEN);
  writeScoreField(m, mem16[HIGH_SCORE], HISCORE_VALUE_DST);

  // each column's side strip runs up from the pointer the digit-write leaves in HL
  const p1Ptr = writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, p1Ptr, UP_LABEL_STRIP, SIDE_LABEL_LEN);
  writeScoreField(m, mem16[PLAYER1_SCORE], P1_SCORE_DST);

  if (mem8[NUM_PLAYERS] === ONE_PLAYER) return;

  const p2Ptr = writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, p2Ptr, UP_LABEL_STRIP, SIDE_LABEL_LEN);
  return writeScoreField(m, mem16[PLAYER2_SCORE], P2_SCORE_DST);
}
