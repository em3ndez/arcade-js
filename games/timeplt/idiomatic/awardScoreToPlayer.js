// SPDX-License-Identifier: GPL-3.0-only
/** awardScoreToPlayer — the score-award command: add the award the argument picks to the current player's
 * packed-decimal score, lift that score into the high score when it now beats it, and repaint the
 * scores it touched. A zero argument takes a separate arm that only (re)paints the score labels
 * and, in a one-player game, blanks the absent second score. A flag can veto the whole command.
 * LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { loc_0ce8 } from "./loc_0ce8.js";
import { paintPlayerOneScoreReadout } from "./paintPlayerOneScoreReadout.js";
import { paintPlayerTwoScoreReadout } from "./paintPlayerTwoScoreReadout.js";
import { paintHighScoreReadout } from "./paintHighScoreReadout.js";
import { drawTextRunByIndex } from "./drawTextRunByIndex.js";
import { eraseTextRunByIndex } from "./eraseTextRunByIndex.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const SCORING_ENABLED = 0xad30;
const PLAYER_COUNT = 0xad31;
const CURRENT_PLAYER = 0xad32;
const PLAYER1_SCORE = 0xad33;
const PLAYER2_SCORE = 0xad36;
const HIGH_SCORE_TOP = 0xa98d;
const AWARD_TABLE = 0x0d27;
const SCORE_BYTES = 3;

const P1_LABEL = 0x06;
const P2_LABEL = 0x07;
const SECOND_SCORE_CELL = 0xa501;
const BLANK = 0xf1;

export function awardScoreToPlayer(m) {
  const { regs, mem8 } = m;
  const award = regs.a;
  if (mem8[SCORING_ENABLED] === 0) return loc_0ce8(m);
  if (award === 0) return repaintScores(m);

  // add the award's three packed-decimal bytes into the player's score, least significant first
  let hl = u16(AWARD_TABLE + SCORE_BYTES * award);
  let de = mem8[CURRENT_PLAYER] === 0 ? PLAYER1_SCORE : PLAYER2_SCORE;
  regs.a = mem8[de]; regs.add(mem8[hl]); regs.daa(); mem8[de] = regs.a;
  de = u16(de + 1); hl = u16(hl + 1);
  regs.a = mem8[de]; regs.adc(mem8[hl]); regs.daa(); mem8[de] = regs.a;
  de = u16(de + 1); hl = u16(hl + 1);
  regs.a = mem8[de]; regs.adc(mem8[hl]); regs.daa(); mem8[de] = regs.a;

  // compare the new score with the high score from the top byte down; on a win copy it in
  hl = HIGH_SCORE_TOP;
  let count = SCORE_BYTES;
  let promote = false;
  for (;;) {
    const scoreByte = mem8[de];
    const highByte = mem8[hl];
    if (scoreByte < highByte) break;
    if (scoreByte !== highByte) { promote = true; break; }
    de = u16(de - 1); hl = u16(hl - 1);
    if (--count === 0) break;
  }
  if (promote) {
    let src = de;
    let dst = hl;
    for (let n = count; n > 0; n--) { mem8[dst] = mem8[src]; src = u16(src - 1); dst = u16(dst - 1); }
    paintHighScoreReadout(m);
  }

  if (mem8[CURRENT_PLAYER] !== 0) paintPlayerTwoScoreReadout(m);
  else paintPlayerOneScoreReadout(m);
  return loc_0ce8(m);
}

function repaintScores(m) {
  const { regs, mem8 } = m;
  if (mem8[PLAYER_COUNT] !== 0) {
    drawTextRunByIndex(m, P1_LABEL);
    paintPlayerOneScoreReadout(m);
    drawTextRunByIndex(m, P2_LABEL);
    paintPlayerTwoScoreReadout(m);
    return;
  }
  drawTextRunByIndex(m, mem8[0x0b31]);
  paintPlayerOneScoreReadout(m);
  eraseTextRunByIndex(m, mem8[0x15c6]);
  // blank the six cells of the vanished second player's score, one screen row apart
  regs.de = SECOND_SCORE_CELL;
  for (let n = 6; n > 0; n--) {
    mem8[regs.de] = BLANK;
    advanceCharCursor(m);
  }
}
