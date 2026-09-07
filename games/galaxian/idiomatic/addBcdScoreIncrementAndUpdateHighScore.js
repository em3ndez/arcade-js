// SPDX-License-Identifier: GPL-3.0-only
/**
 * addBcdScoreIncrementAndUpdateHighScore — award points for a scored event, in packed BCD, and promote
 * the high score when it is beaten.
 *
 * WHAT IT IS
 *   The scoring consumer. A channel-3 command carries a score-type index here. Unless the frame-skip
 *   gate is set, it adds that type's 3-byte packed-BCD increment into the current player's score,
 *   awards the bonus marker once a derived threshold is reached, repaints the player's score digits,
 *   and — only if the new total strictly beats the stored high score — copies it into the high score
 *   and repaints the high-score digits.
 *
 * ROLE IN THE MACHINE
 *   Each player owns a 3-byte packed-BCD score (PLAYER1_SCORE_BCD 0x40a2 / PLAYER2_SCORE_BCD 0x40a5);
 *   selectCurrentPlayerScore returns the active one. The increments live in SCORE_INCREMENT_TABLE
 *   (0x22d0), 3 bytes per score type at index*3. The bonus marker (the row of spare-life icons) is
 *   granted by awardBonusMarker (0x229c) once the derived value from the total's high bytes reaches the
 *   threshold byte loc_40ac (0x40ac, a coinage/config byte latched at boot). The machine keeps one
 *   shared HIGH_SCORE_BCD (0x40a8). CURRENT_PLAYER (0x400d) selects which digit field to paint, and
 *   loc_4007 bit 0 is the frame-skip gate the ROM's rst-08 used to double-return past the whole update.
 *
 * ROM 0x21a6.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: drawHighScoreDigits' result on a new-high path, else nothing meaningful. The player score,
 * possibly the high score, and video RAM are written.
 */
import { selectCurrentPlayerScore } from "./selectCurrentPlayerScore.js";
import { drawScoreToSelectedPlayerField } from "./drawScoreToSelectedPlayerField.js";
import { awardBonusMarker } from "./awardBonusMarker.js";
import { drawHighScoreDigits } from "./drawHighScoreDigits.js";
import { SCORE_INCREMENT_TABLE, CURRENT_PLAYER, HIGH_SCORE_BCD, loc_4007, loc_40ac } from "./names.js";

// Packed-BCD <-> binary helpers: a BCD byte holds two decimal digits (high nibble tens, low nibble
// units). fromBcd unpacks one byte to 0-99; toBcd repacks 0-99 into a byte.
const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (d) => (((d / 10) | 0) << 4) | (d % 10);

export function addBcdScoreIncrementAndUpdateHighScore(m, index = m.regs.a) {
  const { mem8 } = m;

  // rst 08: bit0 set double-returns past this routine — an early skip of the whole update.
  if (mem8[loc_4007] & 1) return;

  const score = selectCurrentPlayerScore(m); // base of the current player's 3-byte packed-BCD score

  // Add the packed-BCD increment at SCORE_INCREMENT_TABLE + index*3 into the score, low byte first.
  // Each byte is added as two decimal digits with a decimal carry into the next byte, matching the
  // 8080's ADD-then-DAA behaviour. `top` keeps the last byte written (the score's high byte at the end).
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
  // top is the score's high byte, mem8[score+1] its middle byte; the shift/mask lifts a coarse
  // "hundreds/thousands" measure that awardBonusMarker fires against the threshold byte loc_40ac.
  const derived = ((((top << 8) | mem8[score + 1]) << 4) >> 8) & 0xff;
  if (derived >= mem8[loc_40ac]) awardBonusMarker(m);

  // Repaint the current player's score digits from the score's high byte down.
  drawScoreToSelectedPlayerField(m, mem8[CURRENT_PLAYER], score + 2);

  // Compare the new total against the stored high score, high byte first; keep it only if strictly higher.
  // Walk both 3-byte scores from their high byte downward: the first byte that differs decides. A lower
  // byte means the total is below the high score (bail); a higher byte means a new record (break).
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
