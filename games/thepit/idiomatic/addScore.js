// SPDX-License-Identifier: GPL-3.0-only
/**
 * addScore — add points to the active player's score and repaint the digits.  ROM 0x4689.
 *
 * The shared scorer behind the thin award entries (+1, +10, +20 each play their own
 * sound and then hand their fixed increment here). The score is a four-digit decimal
 * counter kept as two packed binary-coded-decimal bytes — the two low-order digits at
 * 0x8031 and the two high-order digits at 0x8034. This folds the increment into that
 * counter, low byte then high, carrying a rollover from the low pair up into the high
 * pair, and wrapping at 10000 (there is no fifth digit). It then repaints the active
 * player's on-screen score digits.
 *
 * Only an active player accrues score: the award lands solely while the game mode marks
 * player one or player two in play. In attract, the demo, the between-rounds screens and
 * teardown the mode is anything else, and the whole award is dropped — the score is left
 * untouched and nothing is repainted.
 *
 * The increment matches the value the callers stage in the register pair (a packed-BCD
 * amount: 1, 0x10, 0x20): its low byte is added to the low score byte and its high byte
 * to the high score byte. Every real caller passes a zero high byte, so in practice only
 * the low byte and its carry move the score.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4689.test.js.
 * GATE:     crafted-entry — attract never reaches the scorer (never dispatched or m.call'd
 *           across 1500 frames), so the gate runs it from real captured attract states with
 *           the mode gate poked to reach both the active add path (modes 1, 2) and the idle
 *           skip path (modes 0, 3), plus an exhaustive sweep over every valid packed-BCD
 *           score (low x high) and the real increments {1, 10, 20} on both player columns,
 *           and a whole-RAM contract check proving nothing outside the score bytes and the
 *           digit cells is touched. Teeth: a dropped add, a wrong increment, a lost
 *           low->high carry, and an ignored mode gate.
 * LIVE-OUT: memory-only — the two packed-BCD score bytes and the four repainted digit cells
 *           (drawScoreDigits' own column-base register is dead in the award path; no caller
 *           reads it here). The value registers and flags the oracle path leaves are dead.
 * NAMES:    GAME_MODE (0x8001) — the active-player gate. The score bytes 0x8031 / 0x8034 stay
 *           hex: the packed-BCD score low / high, not yet named in ram.js (matching
 *           drawScoreDigits). The redraw delegates to drawScoreDigits (ROM 0x46af).
 */

import { GAME_MODE } from "./ram.js";
import { drawScoreDigits } from "./drawScoreDigits.js";

// A packed-BCD byte holds two decimal digits, one per nibble. Convert to and from its
// 0..99 value so the add is ordinary decimal arithmetic.
const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (n) => (Math.floor(n / 10) << 4) | n % 10;

export function addScore(m, increment) {
  const { mem8 } = m;

  // Only an active player (mode 1 or 2) accrues score; any other mode drops the award.
  const mode = mem8[GAME_MODE];
  if (mode !== 1 && mode !== 2) return;

  // Low pair: add the increment's low byte, keep a carry when it rolls past 99.
  const lowSum = fromBcd(mem8[0x8031]) + fromBcd(increment & 0xff);
  const carry = lowSum >= 100 ? 1 : 0;
  mem8[0x8031] = toBcd(lowSum % 100);

  // High pair: add the increment's high byte plus the carry from the low pair; the score
  // wraps at 10000, so any overflow past 99 here is simply dropped.
  const highSum = fromBcd(mem8[0x8034]) + fromBcd(increment >> 8) + carry;
  mem8[0x8034] = toBcd(highSum % 100);

  // Repaint the active player's on-screen score digits.
  drawScoreDigits(m);
}
