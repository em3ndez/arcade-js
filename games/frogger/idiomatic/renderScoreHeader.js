// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreHeader — redraw the score header each frame: player-1 label + score, the high-score
 * column (leading digit, side strip, score), and in two-player mode the player-2 column likewise.
 * LIVE-OUT: memory-only (score-header tilemap cells).
 */
import { loc_83ed, loc_83eb } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreField } from "./writeScoreField.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

const PLAYER1_SCORE = 0x83ef;
const PLAYER_COUNT = 0x8370;
const P1_LABEL_SRC = 0x2ee2;
const SIDE_LABEL_SRC = 0x2edf;
const P1_LABEL_DST = 0xaa60;
const P1_SCORE_DST = 0xaa41;
const HI_DIGIT_DST = 0xab20;
const HI_SCORE_DST = 0xab41;
const P2_DIGIT_DST = 0xa900;
const P2_SCORE_DST = 0xa921;

const P1_LABEL_LEN = 8;
const SIDE_LABEL_LEN = 3;
const ONE_PLAYER = 1;

export function renderScoreHeader(m) {
  const { regs, mem8, mem16 } = m;

  copyRunUpTileColumn(m, P1_LABEL_DST, P1_LABEL_SRC, P1_LABEL_LEN);
  regs.hl = P1_SCORE_DST;
  regs.de = mem16[PLAYER1_SCORE];
  writeScoreField(m);

  // side strips go up from the pointer each digit-write leaves in HL
  writeScoreDigitStepUp(m, 1, HI_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = HI_SCORE_DST;
  regs.de = mem16[loc_83ed];
  writeScoreField(m);

  if (mem8[PLAYER_COUNT] === ONE_PLAYER) return;

  writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P2_SCORE_DST;
  regs.de = mem16[loc_83eb];
  return writeScoreField(m);
}
