// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreHeader — redraw the three-column score header each frame: the HI-SCORE column (its label
 * then the high score), the 1-UP column (a "1" digit, the shared "-UP" strip, then player 1's score),
 * and — only in two-player mode — the 2-UP column (a "2" digit, "-UP", then player 2's score).
 * LIVE-OUT: memory-only (score-header tilemap cells).
 */
import { loc_83ef, loc_83ed, loc_83eb, loc_8370, loc_2ee2, loc_2edf } from "./names.js";
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
  const { regs, mem8, mem16 } = m;

  copyRunUpTileColumn(m, HISCORE_LABEL_DST, loc_2ee2, HISCORE_LABEL_LEN);
  regs.hl = HISCORE_VALUE_DST;
  regs.de = mem16[loc_83ef];
  writeScoreField(m);

  // each column's side strip runs up from the pointer the digit-write leaves in HL
  writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, loc_2edf, SIDE_LABEL_LEN);
  regs.hl = P1_SCORE_DST;
  regs.de = mem16[loc_83ed];
  writeScoreField(m);

  if (mem8[loc_8370] === ONE_PLAYER) return;

  writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, loc_2edf, SIDE_LABEL_LEN);
  regs.hl = P2_SCORE_DST;
  regs.de = mem16[loc_83eb];
  return writeScoreField(m);
}
