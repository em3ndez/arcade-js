// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { HIGH_SCORE_OBJ_DESC } from "./names.js";

/**
 * drawHighScore — repaint the high-score total on the score panel.
 *
 * WHAT IT IS
 *   A thin wrapper that seats the high-score record pointer and tail-delegates to the shared score-record
 *   drawer. It is one of three siblings — drawPlayer1Score, drawPlayer2Score, drawHighScore — that each
 *   seat a fixed four-byte record base and hand off to drawScoreRecord.
 *
 * ROLE IN THE MACHINE
 *   HIGH_SCORE_OBJ_DESC (0x20f4) is the third sibling of the two per-player score records; its four bytes
 *   are a BCD value word followed by the two-byte screen address to draw it at. drawScoreRecord (ROM
 *   0x1931) unpacks that record and paints the value as four BCD glyphs at the record's screen slot (see
 *   mechanisms.md, "What is still open"). Called from the boot/attract score-panel repaint redrawScorePanel,
 *   and again by the game-over flow (loc_1671) to repaint the panel after a new high score is set.
 *
 * ROM 0x1950-0x1955.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: RAM-only (the high-score glyphs painted to video RAM); HL is left at the seated record base
 * before the delegated draw advances it.
 */
export function drawHighScore(m) {
  // Seat HL at the high-score record, then fall straight into the shared unpack-and-draw.
  return (m.regs.hl = HIGH_SCORE_OBJ_DESC, drawScoreRecord(m));
}
