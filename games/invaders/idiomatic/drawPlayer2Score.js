// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { PLAYER2_OBJ_DESC } from "./names.js";

/**
 * drawPlayer2Score — repaint player two's score.
 *
 * WHAT IT IS
 *   One of three thin wrappers over the shared score-record painter. It seats HL at player two's score
 *   record and tail-delegates to drawScoreRecord, which unpacks the four-byte record (a BCD value word
 *   then its two-byte screen address) and paints the value as four BCD glyphs at that screen slot.
 *
 * ROLE IN THE MACHINE
 *   PLAYER2_OBJ_DESC (0x20fc) is player two's score-object descriptor — the second of three sibling
 *   records (PLAYER1_OBJ_DESC 0x20f8, PLAYER2_OBJ_DESC 0x20fc, HIGH_SCORE_OBJ_DESC 0x20f4). Its
 *   siblings drawPlayer1Score (0x1925) and drawHighScore (0x1950) seat the other two bases and reach
 *   the same drawScoreRecord (0x1931) body. Called wherever the on-screen scores are refreshed.
 *
 * ROM 0x192b.  Grounding: [seen] (PLAYER2_OBJ_DESC is [seen]).
 *
 * LIVE-OUT: memory only (player two's score digits painted into video RAM); drawScoreRecord's tail
 * completes the ret.
 */
export function drawPlayer2Score(m) {
  // Seat HL at player two's score record, then run the shared score-record painter on it.
  return (m.regs.hl = PLAYER2_OBJ_DESC, drawScoreRecord(m));
}
