// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { PLAYER2_OBJ_DESC } from "./names.js";

// Seat the player-2 score record, then unpack and draw its BCD total at the record's screen slot.
export function drawPlayer2Score(m) {
  return (m.regs.hl = PLAYER2_OBJ_DESC, drawScoreRecord(m));
}
