// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusPoints — the bonus-award helper (a caller-skip). With the slot cursor clear it seeds the
 * floating-score popup (position B, then 0x19/0x03/0x20), arms the popup timer, and adds BCD 0x20 to the
 * score. With the cursor set it raises the hold flag and pops the caller's return instead, returning to
 * the caller's caller and skipping its remainder. LIVE-OUT: memory-only.
 */
import { HOME_BAY_SLOT_CURSOR_MIRROR, GOAL_AWARD_RECORD, HOME_GOAL_SPRITE_ARM_CELL, HOLD_FLAG } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const SCORE_DELTA = 0x0020;

export function awardBonusPoints(m) {
  const { regs, mem8 } = m;

  if (mem8[HOME_BAY_SLOT_CURSOR_MIRROR] !== 0) return skipCaller(m);

  mem8[GOAL_AWARD_RECORD] = regs.b; // B = popup screen position
  mem8[GOAL_AWARD_RECORD + 1] = 0x19;
  mem8[GOAL_AWARD_RECORD + 2] = 0x03;
  mem8[GOAL_AWARD_RECORD + 3] = 0x20;
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = 0xa0;
  regs.de = SCORE_DELTA;
  addScoreAndAwardExtraLife(m);
  m.ret();
}

// The set-cursor arm: raise the hold flag, drop the caller's return, ret to the caller's caller.
function skipCaller(m) {
  const { regs, mem8 } = m;
  mem8[HOLD_FLAG] = 0x01;
  regs.hl = m.pop16();
  m.ret();
}
