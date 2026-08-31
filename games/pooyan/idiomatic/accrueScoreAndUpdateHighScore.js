// SPDX-License-Identifier: GPL-3.0-only
import { selectActivePlayerScoreBuffer } from "./selectActivePlayerScoreBuffer.js";
import { drawBcdCounterColumn } from "./drawBcdCounterColumn.js";
import {
  GAME_ACTIVE_FLAG,
  ACTIVE_PLAYER,
  HIGH_SCORE_BCD,
  PER_FRAME_SCORE_INCREMENT,
  SCORE_AWARD_TABLE,
} from "./names.js";
/**
 * accrueScoreAndUpdateHighScore — credit points to the active player and keep the high score in step.
 *
 * WHAT IT IS
 *   The single point through which the running score grows. Every scoring event in the machine
 *   funnels here with an "award index" that names how many points to add: index 0 means "the
 *   background per-frame trickle" (points that accrue simply for being alive during a phase), and
 *   any other index selects a fixed payout from the score-award table in ROM. The chosen amount is
 *   added into whichever player is currently on-screen, that player's score column is repainted, and
 *   if the new total has overtaken the standing high score the high score is refreshed too.
 *
 * ROLE IN THE MACHINE
 *   Scores are kept as three-byte packed-BCD counters (two decimal digits per byte, low byte first):
 *   the player-1 buffer at 0x88a2, the player-2 buffer at 0x88a5, and the high score at
 *   0x88a8..0x88aa. Each has a vertical on-screen column of stacked digit tiles. This routine writes
 *   the counter cells and drives the digit painter that keeps those columns on screen. Because the
 *   two players share one screen and take turns, everything routes through the "active player"
 *   selector at ACTIVE_PLAYER (0x880d) so the same code serves whoever is currently playing.
 *
 *   ROM 0x0496-0x04f1.  Grounding: [seen].
 *
 * LIVE-OUT: none — the whole effect is in memory. It leaves the active player's BCD counter
 *   advanced, possibly the high-score cells (0x88a8..0x88aa) overwritten, and the corresponding
 *   score column(s) repainted in video RAM. It hands no value back to its caller.
 */

const SCORE_BYTES = 3; // scores are three-byte packed-BCD counters, stored least-significant byte first
const AWARD_STRIDE = 3; // the ROM award table holds one three-byte BCD payout per index, packed back to back
const HISCORE_SELECTOR = 2; // the digit painter's column selector for the high-score row (0 = P1, 1 = P2, 2 = high)

/**
 * bcdAddByte — add two packed-BCD bytes with carry, exactly as the Z80's decimal-adjust (daa) would.
 *
 * A packed-BCD byte holds two decimal digits (each nibble 0-9). A plain binary add of two such bytes
 * can leave a nibble in the illegal 0xa-0xf range or overflow past 99; the hardware corrects this by
 * conditionally adding 0x06 to the low nibble and/or 0x60 to the high nibble. This mirrors that:
 *   - the +0x60 correction fires (and produces a carry out into the next byte) when the raw sum
 *     exceeded 0xff or the high digit landed above 9, i.e. the two-digit total passed 99;
 *   - the +0x06 correction fires when the low digits produced a half-carry or the low nibble landed
 *     above 9.
 * Returns [corrected byte, carry out] so the caller can chain the carry up the multi-byte counter.
 */
function bcdAddByte(x, y, carryIn) {
  const raw = x + y + carryIn;
  const a0 = raw & 0xff;
  const halfCarry = (x & 0x0f) + (y & 0x0f) + carryIn > 0x0f;
  let a = a0;
  let carryOut = 0;
  if (raw > 0xff || a0 > 0x99) { a = (a + 0x60) & 0xff; carryOut = 1; }
  if (halfCarry || (a0 & 0x0f) > 0x09) { a = (a + 0x06) & 0xff; }
  return [a, carryOut];
}

export function accrueScoreAndUpdateHighScore(m, index = m.regs.a) {
  const { mem8 } = m;

  // Gate: only accrue while a life is actually being played. GAME_ACTIVE_FLAG (0x8806) bit 0 is set
  // at start-of-life and cleared at game-over; with it clear (attract screen, between lives) this
  // returns immediately and no points move — the same early-out the ROM takes on the flag.
  if ((mem8[GAME_ACTIVE_FLAG] & 0x01) === 0) return;

  // Pick the destination counter: selectActivePlayerScoreBuffer (0x04f2) reads ACTIVE_PLAYER (0x880d)
  // and hands back the base of whichever player's three-byte BCD score buffer is live this turn.
  const counter = selectActivePlayerScoreBuffer(m); // base of the active player's counter
  // Pick the increment source. Index 0 is the per-frame trickle held at PER_FRAME_SCORE_INCREMENT
  // (0x88ab); any other index reads a fixed payout from the ROM award table SCORE_AWARD_TABLE (0x0501),
  // whose entries are three bytes wide — so the offset is index*3. The & 0xff reproduces the ROM's
  // 8-bit index arithmetic (it forms 3*index in a single 8-bit register before adding the table base).
  const increment =
    index === 0 ? PER_FRAME_SCORE_INCREMENT : SCORE_AWARD_TABLE + ((index * AWARD_STRIDE) & 0xff);

  // Add the increment into the counter as a packed-BCD number: walk the three bytes from the
  // least-significant end upward, feeding each byte's carry-out into the next byte, so decimal
  // overflow ripples correctly (e.g. ...99 + 1 -> ...00 with a carry into the next pair of digits).
  let carry = 0;
  for (let i = 0; i < SCORE_BYTES; i++) {
    const [sum, c] = bcdAddByte(mem8[counter + i], mem8[increment + i], carry);
    mem8[counter + i] = sum;
    carry = c;
  }

  // Repaint the active player's on-screen score column to show the new total. The column selector is
  // derived from ACTIVE_PLAYER (0x880d): bit 0 set picks column 1 (player 2), otherwise the shifted
  // value picks player 1's column (0). drawBcdCounterColumn (0x056b) paints the counter's digits down
  // that column, blanking leading zeros.
  const active = mem8[ACTIVE_PLAYER];
  drawBcdCounterColumn(m, active & 0x01 ? 0x01 : active >> 1);

  // Is this a new high score? Compare the freshly updated counter against the high score at
  // HIGH_SCORE_BCD (0x88a8..0x88aa) most-significant byte first — that is how you order multi-digit
  // BCD numbers. The first byte that differs decides the winner:
  for (let i = SCORE_BYTES - 1; i >= 0; i--) {
    if (mem8[counter + i] < mem8[HIGH_SCORE_BCD + i]) return; // counter below high score — nothing to do
    if (mem8[counter + i] > mem8[HIGH_SCORE_BCD + i]) break; // counter above high score — go promote it
    if (i === 0) return; // every byte matched: score ties the high score, so leave it unchanged
  }

  // New high score: copy the counter over the high-score cells (0x88a8..0x88aa), low byte first, and
  // repaint the high-score column with its own selector (2) so the on-screen high score updates too.
  for (let i = 0; i < SCORE_BYTES; i++) mem8[HIGH_SCORE_BCD + i] = mem8[counter + i];
  drawBcdCounterColumn(m, HISCORE_SELECTOR);
}
