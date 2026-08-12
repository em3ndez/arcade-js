// SPDX-License-Identifier: GPL-3.0-only
/** awardScoreToPlayer — the score-award command: add the award the argument picks to the current player's
 * packed-decimal score, lift that score into the high score when it now beats it, and repaint the
 * scores it touched. A zero argument takes a separate arm that only (re)paints the score labels
 * and, in a one-player game, blanks the absent second score. A flag can veto the whole command.
 * LIVE-OUT: memory. */

import { paintPlayerOneScoreReadout } from "./paintPlayerOneScoreReadout.js";
import { paintPlayerTwoScoreReadout } from "./paintPlayerTwoScoreReadout.js";
import { paintHighScoreReadout } from "./paintHighScoreReadout.js";
import { drawTextRunByIndex } from "./drawTextRunByIndex.js";
import { eraseTextRunByIndex } from "./eraseTextRunByIndex.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { HIGH_SCORE_HI, PLAYER1_SCORE_LO, PLAYER2_SCORE_LO, TWO_PLAYER_GAME, PLAY_ACTIVE, ACTIVE_PLAYER } from "./names.js";

const AWARD_TABLE = 0x0d27;
const SCORE_BYTES = 3;

const P1_LABEL = 0x06;
const P2_LABEL = 0x07;
const SOLE_LABEL_INDEX_CELL = 0x0b31;
const ABSENT_LABEL_INDEX_CELL = 0x15c6;
const SECOND_SCORE_CELL = 0xa501;
const SECOND_SCORE_DIGITS = 6;
const BLANK = 0xf1;

const fromPackedDecimal = (b) => (b >> 4) * 10 + (b & 0x0f);
const toPackedDecimal = (n) => ((n / 10) << 4) | (n % 10);

export function awardScoreToPlayer(m, award = m.regs.a) {
  const { mem8 } = m;
  if (mem8[PLAY_ACTIVE] === 0) return;
  if (award === 0) return repaintScores(m);

  const scoreBase = mem8[ACTIVE_PLAYER] === 0 ? PLAYER1_SCORE_LO : PLAYER2_SCORE_LO;
  addAwardToScore(m, scoreBase, award);
  promoteHighScoreIfBeaten(m, scoreBase);

  if (mem8[ACTIVE_PLAYER] !== 0) paintPlayerTwoScoreReadout(m);
  else paintPlayerOneScoreReadout(m);
  return;
}

/** Add the packed-decimal award the argument selects into the score, least significant byte first. */
function addAwardToScore(m, scoreBase, award) {
  const { mem8 } = m;
  const awardBase = AWARD_TABLE + SCORE_BYTES * award;
  let carry = 0;
  for (let i = 0; i < SCORE_BYTES; i++) {
    const sum = fromPackedDecimal(mem8[scoreBase + i]) + fromPackedDecimal(mem8[awardBase + i]) + carry;
    carry = sum >= 100 ? 1 : 0;
    mem8[scoreBase + i] = toPackedDecimal(sum % 100);
  }
}

/** Copy the freshly credited score into the high score, and repaint it, once it leads. The score is
 * stored low byte first from scoreBase; the high score high byte first from HIGH_SCORE_HI, so both
 * are read most significant byte first as k counts up. */
function promoteHighScoreIfBeaten(m, scoreBase) {
  const { mem8 } = m;
  const scoreByte = (k) => mem8[scoreBase + (SCORE_BYTES - 1 - k)];
  const highByte = (k) => mem8[HIGH_SCORE_HI - k];
  let k = 0;
  while (k < SCORE_BYTES && scoreByte(k) === highByte(k)) k++;
  if (k === SCORE_BYTES || scoreByte(k) < highByte(k)) return;
  for (let j = 0; j < SCORE_BYTES; j++) mem8[HIGH_SCORE_HI - j] = scoreByte(j);
  paintHighScoreReadout(m);
}

function repaintScores(m) {
  const { mem8 } = m;
  if (mem8[TWO_PLAYER_GAME] !== 0) {
    drawTextRunByIndex(m, P1_LABEL);
    paintPlayerOneScoreReadout(m);
    drawTextRunByIndex(m, P2_LABEL);
    paintPlayerTwoScoreReadout(m);
    return;
  }
  drawTextRunByIndex(m, mem8[SOLE_LABEL_INDEX_CELL]);
  paintPlayerOneScoreReadout(m);
  eraseTextRunByIndex(m, mem8[ABSENT_LABEL_INDEX_CELL]);
  // blank the six cells of the vanished second player's score, stepping the cursor per cell.
  // advanceCharCursor takes the cursor and returns the next cell, so no register is threaded here.
  let cursor = SECOND_SCORE_CELL;
  for (let i = 0; i < SECOND_SCORE_DIGITS; i++) {
    mem8[cursor] = BLANK;
    cursor = advanceCharCursor(m, cursor);
  }
}
