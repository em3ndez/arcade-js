// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { PLAYER1_OBJ_DESC } from "./names.js";

// Seat the player-1 score record, then unpack and draw its BCD total at the record's screen slot.
export function loc_1925(m) {
  return (m.regs.hl = PLAYER1_OBJ_DESC, drawScoreRecord(m));
}
