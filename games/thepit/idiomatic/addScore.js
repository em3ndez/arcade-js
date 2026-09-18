// SPDX-License-Identifier: GPL-3.0-only
/**
 * addScore — fold a packed-BCD increment into the active player's score, then repaint the digits.
 *
 * The score is a four-digit decimal counter in two packed-BCD bytes, SCORE_LO (the low two
 * digits) and SCORE_HI (the high two). The increment's low byte adds to SCORE_LO and its high
 * byte to SCORE_HI, a rollover past 99 carries low->high, and the total wraps at 10000. Only an
 * active player accrues score — the award applies while GAME_STATE marks player one or two in
 * play and is dropped in every other mode. Callers pass a zero high byte in practice, so only the
 * low byte and its carry move the score. The redraw delegates to drawScoreDigits; the score bytes
 * and the repainted digit cells are the only memory this leaves.
 */

import { GAME_STATE, SCORE_HI, SCORE_LO } from "./names.js";
import { drawScoreDigits } from "./drawScoreDigits.js";

// A packed-BCD byte holds two decimal digits, one per nibble. Convert to and from its
// 0..99 value so the add is ordinary decimal arithmetic.
const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (n) => (Math.floor(n / 10) << 4) | n % 10;

export function addScore(m, increment) {
  const { mem8 } = m;

  const mode = mem8[GAME_STATE];
  if (mode !== 1 && mode !== 2) return;

  // Low pair: add the increment's low byte, keep a carry when it rolls past 99.
  const lowSum = fromBcd(mem8[SCORE_LO]) + fromBcd(increment & 0xff);
  const carry = lowSum >= 100 ? 1 : 0;
  mem8[SCORE_LO] = toBcd(lowSum % 100);

  // High pair: add the high byte plus the low pair's carry; overflow past 99 is dropped.
  const highSum = fromBcd(mem8[SCORE_HI]) + fromBcd(increment >> 8) + carry;
  mem8[SCORE_HI] = toBcd(highSum % 100);

  drawScoreDigits(m);
}
