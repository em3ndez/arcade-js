// SPDX-License-Identifier: GPL-3.0-only
import { SCORE_ADD_PENDING, SCORE_ADD_VALUE } from "./names.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawBcdWord } from "./drawBcdWord.js";

// One BCD byte add with 8080 ADD-then-DAA semantics: sum x+y+carryIn, decimal-adjust, and report the
// adjusted byte plus its decimal carry-out (fed as the next byte's carry-in).
function bcdAdd(x, y, carryIn) {
  const sum = x + y + carryIn;
  const res = sum & 0xff;
  const halfCarry = ((x ^ y ^ res) & 0x10) !== 0;
  let adjust = 0;
  let carry = sum > 0xff;
  if (halfCarry || (res & 0x0f) > 9) adjust |= 0x06;
  if (carry || res > 0x99) { adjust |= 0x60; carry = true; }
  return [(res + adjust) & 0xff, carry ? 1 : 0];
}

// When a score add is pending, fold the pending two-byte BCD delta into the active player's running
// total (clearing the pending flag), then redraw that total at the record's stored screen address.
export function applyPendingScoreAdd(m) {
  const rec = currentPlayerRecordPtr(m);
  if (m.mem8[SCORE_ADD_PENDING] === 0) return;
  m.mem8[SCORE_ADD_PENDING] = 0;
  const delta = m.mem16[SCORE_ADD_VALUE];
  const [lo, carry] = bcdAdd(m.mem8[rec], delta & 0xff, 0);
  m.mem8[rec] = lo;
  const [hi] = bcdAdd(m.mem8[rec + 1], (delta >> 8) & 0xff, carry);
  m.mem8[rec + 1] = hi;
  const screen = (m.mem8[rec + 3] << 8) | m.mem8[rec + 2];
  return (m.regs.hl = screen, drawBcdWord(m, hi, lo));
}
