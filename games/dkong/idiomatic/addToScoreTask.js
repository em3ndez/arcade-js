// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToScoreTask — bump the player-up's score by a table amount, redraw it, and promote
 * it to the high score if it now leads. Skipped during attract.
 *
 * LIVE-OUT: memory-only — the updated score counter, the high-score counter (when it
 * leads), and the six-digit score and high-score readouts.
 */

import { CURRENT_PLAYER, HIGH_SCORE } from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";
import { selectCurrentPlayerScoreCounter } from "./selectCurrentPlayerScoreCounter.js";
import { loc_056b } from "./loc_056b.js";
import { drawHighScore } from "./drawHighScore.js";

const SCORE_ADDEND_TABLE = 0x3529;

export function addToScoreTask(m) {
  const { regs, mem8 } = m;

  const payload = regs.a & 0xff;

  if (!gameActiveGuard(m)) return;

  regs.de = selectCurrentPlayerScoreCounter(m);

  // (payload * 3) taken as a single byte — a large payload wraps back into the table.
  let addendPtr = (SCORE_ADDEND_TABLE + ((payload * 3) & 0xff)) & 0xffff;

  let carry = 0;
  for (let i = 0; i < 3; i++) {
    regs.a = mem8[regs.de];
    regs.add(mem8[addendPtr], carry);
    regs.daa();
    carry = regs.fC ? 1 : 0;
    mem8[regs.de] = regs.a;
    regs.de = (regs.de + 1) & 0xffff;
    addendPtr = (addendPtr + 1) & 0xffff;
  }
  const scoreEnd = regs.de; // one past the counter's top byte

  regs.de = (scoreEnd - 1) & 0xffff;
  regs.a = mem8[CURRENT_PLAYER];
  loc_056b(m);

  // Compare against the high score, top byte first, walking down.
  regs.de = (scoreEnd - 1) & 0xffff;
  let hsPtr = (HIGH_SCORE + 2) & 0xffff;
  let width = 3; // bytes still to resolve — also the copy width, carried over deliberately
  for (;;) {
    const scoreByte = mem8[regs.de];
    const hsByte = mem8[hsPtr];
    if (scoreByte < hsByte) return;
    if (scoreByte !== hsByte) break;
    regs.de = (regs.de - 1) & 0xffff;
    hsPtr = (hsPtr - 1) & 0xffff;
    width -= 1;
    if (width === 0) return;
  }

  // The new score leads: copy the still-unresolved low bytes over the high score.
  regs.de = selectCurrentPlayerScoreCounter(m);
  let hsDst = HIGH_SCORE;
  for (let i = 0; i < width; i++) {
    mem8[hsDst] = mem8[regs.de];
    regs.de = (regs.de + 1) & 0xffff;
    hsDst = (hsDst + 1) & 0xffff;
  }

  drawHighScore(m);
}
