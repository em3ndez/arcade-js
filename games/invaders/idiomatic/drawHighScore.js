// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { HIGH_SCORE_OBJ_DESC } from "./names.js";

// Seat the high-score record, then unpack and draw its BCD total at the record's screen slot.
export function drawHighScore(m) {
  return (m.regs.hl = HIGH_SCORE_OBJ_DESC, drawScoreRecord(m));
}
