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
import { bcdAddByte } from "../../../core/bcd.js";

const SCORE_ADDEND_TABLE = 0x3529;

export function addToScoreTask(m, a = m.regs.a) {
  const { regs, mem8 } = m;

  const payload = a & 0xff;

  if (!gameActiveGuard(m)) return;

  let scorePtr = selectCurrentPlayerScoreCounter(m);

  // (payload * 3) taken as a single byte — a large payload wraps back into the table.
  let addendPtr = (SCORE_ADDEND_TABLE + ((payload * 3) & 0xff)) & 0xffff;

  // Three-byte packed-BCD add, low byte first, threading the decimal carry.
  let carry = 0;
  for (let i = 0; i < 3; i++) {
    const sum = bcdAddByte(mem8[scorePtr], mem8[addendPtr], carry);
    mem8[scorePtr] = sum.value;
    carry = sum.carry;
    scorePtr = (scorePtr + 1) & 0xffff;
    addendPtr = (addendPtr + 1) & 0xffff;
  }
  const scoreEnd = scorePtr; // one past the counter's top byte

  // Redraw the score readout. The column renderer reads its source pointer from the DE
  // register, so hand it the counter's top byte there — the one machine bridge that remains.
  regs.de = (scoreEnd - 1) & 0xffff;
  loc_056b(m, mem8[CURRENT_PLAYER]);

  // Compare against the high score, top byte first, walking down.
  let cmpPtr = (scoreEnd - 1) & 0xffff;
  let hsPtr = (HIGH_SCORE + 2) & 0xffff;
  let width = 3; // bytes still to resolve — also the copy width, carried over deliberately
  for (;;) {
    const scoreByte = mem8[cmpPtr];
    const hsByte = mem8[hsPtr];
    if (scoreByte < hsByte) return;
    if (scoreByte !== hsByte) break;
    cmpPtr = (cmpPtr - 1) & 0xffff;
    hsPtr = (hsPtr - 1) & 0xffff;
    width -= 1;
    if (width === 0) return;
  }

  // The new score leads: copy the still-unresolved low bytes over the high score.
  let srcPtr = selectCurrentPlayerScoreCounter(m);
  let hsDst = HIGH_SCORE;
  for (let i = 0; i < width; i++) {
    mem8[hsDst] = mem8[srcPtr];
    srcPtr = (srcPtr + 1) & 0xffff;
    hsDst = (hsDst + 1) & 0xffff;
  }

  drawHighScore(m);
}
