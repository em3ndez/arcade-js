// SPDX-License-Identifier: GPL-3.0-only
import { SCORE_ADD_PENDING, SCORE_ADD_VALUE } from "./names.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawBcdWord } from "./drawBcdWord.js";

/**
 * applyPendingScoreAdd — fold a queued score delta into the active player's total and repaint it.
 *
 * WHAT IT IS
 *   Scoring in Space Invaders is deferred: when the player kills something, the scoring cue does not
 *   touch the score directly — it stamps the point value into a small three-cell "pending" packet and
 *   raises a flag. This routine is the consumer. Once per main-loop pass it checks that flag; if a score
 *   add is pending it clears the flag, BCD-adds the queued two-byte value into the active player's
 *   running score, and redraws that score on screen. A clear flag makes it a no-op.
 *
 * ROLE IN THE MACHINE
 *   The pending packet is three adjacent cells: SCORE_ADD_PENDING (0x20f1, the flag), SCORE_ADD_VALUE
 *   (0x20f2) and SCORE_ADD_VALUE_HI (0x20f3) — read here as the 16-bit little-endian word at
 *   SCORE_ADD_VALUE. The active player's score lives in that player's descriptor record, located by
 *   currentPlayerRecordPtr (PLAYER1_OBJ_DESC 0x20f8 or PLAYER2_OBJ_DESC 0x20fc, chosen by bit 0 of
 *   ACTIVE_PLAYER_PAGE). The record's first two bytes are the BCD score (low then high); rec+2/rec+3 are
 *   the little-endian screen address where the score is drawn. mainLoop calls this every pass (mechanisms.md,
 *   in-game main loop). The add is BCD because the 8080 keeps scores in packed decimal and decimal-adjusts
 *   after each byte add.
 *
 * ROM 0x0988-....  Grounding: [seen].
 *
 * LIVE-OUT: HL = the score's screen address; then drawBcdWord's result. Memory + video RAM written.
 */

// One BCD byte add with 8080 ADD-then-DAA semantics: sum x+y+carryIn, decimal-adjust, and report the
// adjusted byte plus its decimal carry-out (fed as the next byte's carry-in).
//
// The 8080 DAA rule reproduced here: if the low nibble exceeds 9 or a half-carry occurred, add 0x06; if
// the high nibble exceeds 9 (value > 0x99) or a full carry occurred, add 0x60 and assert carry out. That
// keeps each nibble a valid decimal digit and propagates decimal carry between the two score bytes.
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
  // Locate the active player's score descriptor (0x20f8 / 0x20fc by the ACTIVE_PLAYER_PAGE selector bit).
  const rec = currentPlayerRecordPtr(m);
  // Nothing queued -> nothing to do this pass. The flag is the whole gate.
  if (m.mem8[SCORE_ADD_PENDING] === 0) return;
  // Consume the pending packet: clear the flag so the next kill re-arms it, and read the queued delta as
  // the little-endian word SCORE_ADD_VALUE/SCORE_ADD_VALUE_HI.
  m.mem8[SCORE_ADD_PENDING] = 0;
  const delta = m.mem16[SCORE_ADD_VALUE];
  // BCD-add the low score byte with the delta's low byte (no carry in); store the adjusted digit pair back
  // and carry the decimal overflow up.
  const [lo, carry] = bcdAdd(m.mem8[rec], delta & 0xff, 0);
  m.mem8[rec] = lo;
  // BCD-add the high score byte with the delta's high byte, taking the carry from the low add.
  const [hi] = bcdAdd(m.mem8[rec + 1], (delta >> 8) & 0xff, carry);
  m.mem8[rec + 1] = hi;
  // Recover the score's on-screen address from rec+2 (low) / rec+3 (high) and repaint the new total as
  // four BCD glyphs (high byte then low) via drawBcdWord.
  const screen = (m.mem8[rec + 3] << 8) | m.mem8[rec + 2];
  return (m.regs.hl = screen, drawBcdWord(m, hi, lo));
}
