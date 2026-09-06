// SPDX-License-Identifier: GPL-3.0-only
// — packed-BCD score update. On a set bit0 the rst-08 gate skips the whole update;
// otherwise add this kill/score type's 3-byte packed-BCD increment into the current player's score,
// award the bonus marker once a derived threshold is reached, repaint the score digits, and — if the new
// total beats the stored high score — copy it into the high score and repaint those digits.
import { selectCurrentPlayerScore } from "./selectCurrentPlayerScore.js";
import { drawScoreToSelectedPlayerField } from "./drawScoreToSelectedPlayerField.js";
import { awardBonusMarker } from "./awardBonusMarker.js";
import { drawHighScoreDigits } from "./drawHighScoreDigits.js";
import { SCORE_INCREMENT_TABLE, CURRENT_PLAYER, HIGH_SCORE_BCD, loc_4007, loc_40ac } from "./names.js";

const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (d) => (((d / 10) | 0) << 4) | (d % 10);

export function loc_21a6(m, index = m.regs.a) {
  const { mem8 } = m;

  // rst 08: bit0 set double-returns past this routine — an early skip of the whole update.
  if (mem8[loc_4007] & 1) return;

  const score = selectCurrentPlayerScore(m); // base of the current player's 3-byte packed-BCD score

  // Add the packed-BCD increment at SCORE_INCREMENT_TABLE + index*3 into the score, low byte first.
  const inc = SCORE_INCREMENT_TABLE + index * 3;
  let carry = 0;
  let top = 0;
  for (let i = 0; i < 3; i++) {
    const sum = fromBcd(mem8[score + i]) + fromBcd(mem8[inc + i]) + carry;
    top = toBcd(sum % 100);
    mem8[score + i] = top;
    carry = sum >= 100 ? 1 : 0;
  }

  // Bonus marker: derive ((top<<8 | middle) << 4)'s high byte and award once it reaches.
  const derived = ((((top << 8) | mem8[score + 1]) << 4) >> 8) & 0xff;
  if (derived >= mem8[loc_40ac]) awardBonusMarker(m);

  // Repaint the current player's score digits from the score's high byte down.
  drawScoreToSelectedPlayerField(m, mem8[CURRENT_PLAYER], score + 2);

  // Compare the new total against the stored high score, high byte first; keep it only if strictly higher.
  let cur = score + 2;
  let best = HIGH_SCORE_BCD + 2;
  let higher = false;
  for (let i = 0; i < 3; i++) {
    if (mem8[cur] < mem8[best]) return; // new total below stored: leave it
    if (mem8[cur] > mem8[best]) { higher = true; break; }
    cur -= 1;
    best -= 1;
  }
  if (!higher) return; // equal total: nothing to store

  // New high score: copy the 3-byte total into HIGH_SCORE_BCD and repaint the high-score digits.
  for (let i = 0; i < 3; i++) mem8[HIGH_SCORE_BCD + i] = mem8[score + i];
  return drawHighScoreDigits(m, score + 2);
}
