// SPDX-License-Identifier: GPL-3.0-only
// Redraw the packed-BCD score column selected by counter index: 0 -> player-1 score (primary field),
// 1 -> player-2 score (alt field, drawn only when its live flag is set, which also picks the alt field),
// 2 -> high score. An index of 3 or more descends, redrawing every field from index-1 down to 0.
import { drawScoreToSelectedPlayerField } from "./drawScoreToSelectedPlayerField.js";
import { drawHighScoreDigits } from "./drawHighScoreDigits.js";
import { u8 } from "../../../core/int.js";
import { PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD, HIGH_SCORE_BCD, loc_400e } from "./names.js";

const BCD_TOP = 2;         // a field's most-significant byte; drawBcd walks downward from here
const PRIMARY_FIELD = 0;   // field selector 0 -> primary player field

export function drawScoreFieldByIndex(m, index = m.regs.a) {
  const { mem8 } = m;

  if (index >= 3) {
    let i = index;
    for (;;) {
      i = u8(i - 1);
      drawScoreFieldByIndex(m, i);
      if (i === 0) return;
    }
  }

  if (index === 0) return drawScoreToSelectedPlayerField(m, PRIMARY_FIELD, PLAYER1_SCORE_BCD + BCD_TOP);
  if (index === 2) return drawHighScoreDigits(m, HIGH_SCORE_BCD + BCD_TOP);

  // index === 1
  const gate = mem8[loc_400e];
  if (gate === 0) return;
  return drawScoreToSelectedPlayerField(m, gate, PLAYER2_SCORE_BCD + BCD_TOP);
}
