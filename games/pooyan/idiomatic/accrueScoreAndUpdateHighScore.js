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
 * accrueScoreAndUpdateHighScore — accrue the active player's score and keep the high score in step.
 *
 * Runs only while the game-active flag's bit 0 is set. The award index picks a 3-byte BCD
 * increment: index 0 uses the per-frame increment cell, any other index reads the award table
 * (stride 3). The increment is BCD-added into the active player's counter, the counter's column
 * is repainted, then the counter is compared MSB-first with the high score — a strictly greater
 * counter is copied over the high score and repainted with the high-score selector.
 *
 * LIVE-OUT: none — memory-only. Reached only by table dispatch (no caller reads a result
 * register); the counter/high-score cells and the repainted score columns are the whole effect.
 */

const SCORE_BYTES = 3; // three-byte packed-BCD counters, little-endian (LSB first)
const AWARD_STRIDE = 3; // per-index width of the award table
const HISCORE_SELECTOR = 2; // repaint selector for the high-score row

/** Packed-BCD byte add faithful to the Z80 daa: returns [sum byte, carry out]. */
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

  // Gate: accrue only while the game is live (game-active flag bit 0 set).
  if ((mem8[GAME_ACTIVE_FLAG] & 0x01) === 0) return;

  const counter = selectActivePlayerScoreBuffer(m); // base of the active player's counter
  const increment =
    index === 0 ? PER_FRAME_SCORE_INCREMENT : SCORE_AWARD_TABLE + ((index * AWARD_STRIDE) & 0xff);

  // BCD-add the increment into the counter, carry chained from the least-significant byte up.
  let carry = 0;
  for (let i = 0; i < SCORE_BYTES; i++) {
    const [sum, c] = bcdAddByte(mem8[counter + i], mem8[increment + i], carry);
    mem8[counter + i] = sum;
    carry = c;
  }

  // Repaint the active player's score column (selector from ACTIVE_PLAYER's bit 0).
  const active = mem8[ACTIVE_PLAYER];
  drawBcdCounterColumn(m, active & 0x01 ? 0x01 : active >> 1);

  // Compare the counter with the high score, most-significant byte first.
  for (let i = SCORE_BYTES - 1; i >= 0; i--) {
    if (mem8[counter + i] < mem8[HIGH_SCORE_BCD + i]) return; // counter below high score
    if (mem8[counter + i] > mem8[HIGH_SCORE_BCD + i]) break; // counter above: take it
    if (i === 0) return; // all bytes equal: no change
  }

  // New high score: copy the counter over it and repaint the high-score column.
  for (let i = 0; i < SCORE_BYTES; i++) mem8[HIGH_SCORE_BCD + i] = mem8[counter + i];
  drawBcdCounterColumn(m, HISCORE_SELECTOR);
}
