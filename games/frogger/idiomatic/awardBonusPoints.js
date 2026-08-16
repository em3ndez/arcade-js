// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusPoints — the bonus-award helper (a caller-skip). With the slot cursor clear it seeds the
 * floating-score popup (position B, then 0x19/0x03/0x20), arms the popup timer, and adds BCD 0x20 to the
 * score. With the cursor set it raises the hold flag and pops the caller's return instead, returning to
 * the caller's caller and skipping its remainder. LIVE-OUT: memory-only.
 */
import { loc_8120, loc_805c, loc_8340, HOLD_FLAG } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const SCORE_DELTA = 0x0020;

export function awardBonusPoints(m) {
  const { regs, mem8 } = m;

  if (mem8[loc_8120] !== 0) return skipCaller(m);

  mem8[loc_805c] = regs.b; // B = popup screen position
  mem8[loc_805c + 1] = 0x19;
  mem8[loc_805c + 2] = 0x03;
  mem8[loc_805c + 3] = 0x20;
  mem8[loc_8340] = 0xa0;
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
