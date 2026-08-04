// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardRemainingBonusToScore — cash the bonus readout in: pay the player one score award per digit.
 *
 * The readout is a single byte holding two digits, one per nibble, and each digit buys an award off
 * a table of fixed amounts. The routine runs the add-to-score task twice:
 *
 *   - the LOW digit selects a "small" award — the table index is the digit itself, and index 0 adds
 *     nothing, so a digit of 0 costs nothing and pays nothing.
 *   - the HIGH digit selects a "large" award — the same task and the same table, but the index is
 *     offset by ten, so index 10 is that half's do-nothing entry.
 *
 * So the tens digit is worth an order of magnitude more than the units digit, which is what makes
 * this a payout of the readout's face value rather than two unrelated awards.
 *
 * NOT CLAIMED: that a nibble above 9 is impossible. Nothing here rejects one — it would simply
 * select a further table index — and no such value was looked for.
 *
 * LIVE-OUT: memory-only — whatever the add-to-score task writes for each of the two awards.
 */

import { BONUS_DISPLAY } from "./names.js";
import { addToScoreTask } from "./addToScoreTask.js";

export function awardRemainingBonusToScore(m) {
  const { regs, mem } = m;

  // The readout byte: low nibble picks the small award, high nibble the large one.
  const packed = mem.read8(BONUS_DISPLAY);

  // First award: the low digit is the payload directly.
  regs.a = packed & 0x0f;
  addToScoreTask(m);

  // Second award: the high digit, its table index offset by ten.
  regs.a = ((packed >> 4) + 0x0a) & 0xff;
  addToScoreTask(m);
}
