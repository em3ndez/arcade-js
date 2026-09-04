// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { PLAYER1_OBJ_DESC } from "./names.js";

/**
 * drawPlayer1Score -- repaint player 1's score in the top score band.
 *
 * WHAT IT IS
 *   One of three thin wrappers (with drawPlayer2Score and drawHighScore) that front the shared
 *   score-record draw. Each seats a fixed record base and tail-delegates to drawScoreRecord; this one
 *   seats player 1's record.
 *
 * ROLE IN THE MACHINE
 *   PLAYER1_OBJ_DESC (0x20f8) is a four-byte record: a two-byte BCD score value followed by its two-byte
 *   screen address. drawScoreRecord unpacks that record and paints the value as four BCD glyphs at the
 *   record's screen slot. Called from the score-panel repaint redrawScorePanel (boot/attract) so the
 *   header, both player scores, the high score, and the credit line come up as one static frame.
 *
 * ROM 0x1925.  Grounding: [seen].
 *
 * LIVE-OUT: HL = PLAYER1_OBJ_DESC on entry to drawScoreRecord; RAM/video-RAM only for callers.
 */
export function drawPlayer1Score(m) {
  // Seat HL at player 1's four-byte score record, then hand off to the shared unpack-and-draw routine.
  return (m.regs.hl = PLAYER1_OBJ_DESC, drawScoreRecord(m));
}
