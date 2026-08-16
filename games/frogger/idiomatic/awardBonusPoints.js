// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusPoints — with the slot cursor clear, seed the floating-score popup, arm its timer, add BCD
 * 0x20 to the score, and return false. With the cursor set, raise the hold flag and return true so the
 * caller skips its remainder (a caller-skip in the original). LIVE-OUT: memory-only.
 */
import { HOME_BAY_SLOT_CURSOR_MIRROR, GOAL_AWARD_RECORD, HOME_GOAL_SPRITE_ARM_CELL, HOLD_FLAG } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const SCORE_DELTA = 0x0020;

export function awardBonusPoints(m, popupPos = m.regs.b) {
  const { mem8 } = m;

  if (mem8[HOME_BAY_SLOT_CURSOR_MIRROR] !== 0) {
    mem8[HOLD_FLAG] = 0x01;
    return true;
  }

  mem8[GOAL_AWARD_RECORD] = popupPos; // popup screen position
  mem8[GOAL_AWARD_RECORD + 1] = 0x19;
  mem8[GOAL_AWARD_RECORD + 2] = 0x03;
  mem8[GOAL_AWARD_RECORD + 3] = 0x20;
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = 0xa0;
  m.regs.de = SCORE_DELTA; // bridge: the register-reading score routine consumes DE
  addScoreAndAwardExtraLife(m);
  return false;
}
