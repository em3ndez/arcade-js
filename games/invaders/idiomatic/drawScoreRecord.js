// SPDX-License-Identifier: GPL-3.0-only
import { drawBcdWord } from "./drawBcdWord.js";

/**
 * drawScoreRecord — draw a four-byte score record's BCD value at its own stored screen address.
 *
 * WHAT IT IS
 *   The shared body behind all three on-screen score totals. A "score record" is four bytes: a 16-bit
 *   BCD value (low byte then high byte) followed by a 16-bit screen address (low then high). This
 *   unpacks the record at HL and paints the value as four decimal glyphs at that address.
 *
 * ROLE IN THE MACHINE
 *   Reached through three thin seaters that each point HL at a fixed record and tail here (see
 *   mechanisms.md "What is still open" / "Attract screen and status display"): drawPlayer1Score
 *   (PLAYER1_OBJ_DESC 0x20f8), drawPlayer2Score (PLAYER2_OBJ_DESC 0x20fc), and drawHighScore
 *   (HIGH_SCORE_OBJ_DESC 0x20f4). The value word goes to drawBcdWord as (high byte D, low byte E),
 *   which draws D then E via drawBcdByte — four BCD digits, most-significant pair first — at the
 *   record's screen address. Because each record carries its own address, one body serves all three
 *   score positions.
 *
 * ROM 0x1931.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = advanced by drawBcdWord past the drawn glyphs (it is first seated to the record's
 *   screen address here); DE preserved by drawBcdWord. RAM-only effect for the callers, which ignore it.
 */
export function drawScoreRecord(m, hl = m.regs.hl) {
  // Unpack the four-byte record at HL: E = BCD value low byte, D = BCD value high byte, A = screen
  // address low byte, H = screen address high byte.
  const e = m.mem8[hl];
  const d = m.mem8[hl + 1];
  const a = m.mem8[hl + 2];
  const h = m.mem8[hl + 3];
  // Seat HL at the record's own screen address (H:A) and draw the value D:E as four BCD glyphs there.
  return (m.regs.hl = (h << 8) | a, drawBcdWord(m, d, e));
}
