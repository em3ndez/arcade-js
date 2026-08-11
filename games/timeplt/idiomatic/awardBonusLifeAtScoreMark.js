// SPDX-License-Identifier: GPL-3.0-only
/** awardBonusLifeAtScoreMark — award the next milestone the moment a tally reaches one of its marks, once only.
 * Nothing happens unless play is active. A settings bit picks which mark list applies and a one-bit selector which
 * of two tallies; only the tally's top byte is matched EXACTLY (a tally that steps over a mark never hits it). A
 * latch bit makes it one-shot -- matching while set does nothing, and the first non-match clears it, so the same
 * mark pays again next time round the tally. Awarding steps a running count and requests the award + its sound, the
 * pre-step count going out with the request. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { ACTIVE_PLAYER, LIVES_REMAINING, PLAYER1_SCORE_HI, PLAYER2_SCORE_HI, PLAY_ACTIVE } from "./names.js";
import { postCommand } from "./postCommand.js";
import { requestBonusLifeSound } from "./requestBonusLifeSound.js";

const SETTING = 0xa9c3;
const MARKS_WHEN_CLEAR = 0x4e1b;
const MARKS_WHEN_SET = 0x4e30;
const LATCH = 0xad03;
const LATCH_BIT = 0x01;
const AWARD_COMMAND = 5;
const A_ZERO_LENGTH_MEANS = 65536;

export function awardBonusLifeAtScoreMark(m) {
  const { mem8 } = m;
  if (mem8[PLAY_ACTIVE] === 0) return;

  const marks = (mem8[SETTING] & 1) === 0 ? MARKS_WHEN_CLEAR : MARKS_WHEN_SET;
  const length = mem8[marks];
  const span = length === 0 ? A_ZERO_LENGTH_MEANS : length;
  const reached = mem8[mem8[ACTIVE_PLAYER] === 0 ? PLAYER1_SCORE_HI : PLAYER2_SCORE_HI];

  let matched = false;
  for (let i = 1; i <= span && !matched; i++) matched = mem8[u16(marks + i)] === reached;

  if (!matched) {
    mem8[LATCH] &= ~LATCH_BIT;
    return;
  }
  if ((mem8[LATCH] & LATCH_BIT) !== 0) return;
  mem8[LATCH] |= LATCH_BIT;

  const awardsSoFar = mem8[LIVES_REMAINING];
  mem8[LIVES_REMAINING] = awardsSoFar + 1;
  postCommand(m, AWARD_COMMAND, awardsSoFar);
  requestBonusLifeSound(m);
}
