// SPDX-License-Identifier: GPL-3.0-only
import { drawScoreRecord } from "./drawScoreRecord.js";
import { loc_20f4 } from "./names.js";

// Seat the high-score record, then unpack and draw its BCD total at the record's screen slot.
export function loc_1950(m) {
  return (m.regs.hl = loc_20f4, drawScoreRecord(m));
}
