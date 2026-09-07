// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreFieldByIndex — repaint one score field (or all of them) selected by a counter index.
 *
 * WHAT IT IS
 *   The score-repaint dispatcher reached from display-command opcode 5. A single index chooses which of
 *   the three packed-BCD score fields to redraw in place:
 *     0 -> player-1 score, drawn into the primary VRAM field.
 *     1 -> player-2 score, drawn into the alternate field, but ONLY while the live flag loc_400e (0x400e)
 *          is set — and that same flag value doubles as the field selector handed to the field painter.
 *     2 -> the shared high score.
 *   An index of 3 or more is the "redraw everything" form: it descends, redrawing every field from
 *   index-1 down to 0 in turn.
 *
 * ROLE IN THE MACHINE
 *   Each score is a three-byte packed-BCD field: PLAYER1_SCORE_BCD (0x40a2), PLAYER2_SCORE_BCD (0x40a5),
 *   HIGH_SCORE_BCD (0x40a8). The leaf painters walk a field DOWNWARD from its most-significant byte, so
 *   every source pointer passed here is base + BCD_TOP (+2) — the top byte — and the painter reads top,
 *   middle, low. Index 0 and 1 route through drawScoreToSelectedPlayerField (0x2256, which loads the
 *   right VRAM digit-field cursor); index 2 routes through drawHighScoreDigits (0x21f8). The >=3 case
 *   recurses on itself, so one call with a large index refreshes the whole score panel.
 *
 * ROM 0x2231.  Grounding: [seen].
 *
 * LIVE-OUT: whatever the selected leaf painter returns (the chosen score field(s) repainted in VRAM).
 */
import { drawScoreToSelectedPlayerField } from "./drawScoreToSelectedPlayerField.js";
import { drawHighScoreDigits } from "./drawHighScoreDigits.js";
import { u8 } from "../../../core/int.js";
import { PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD, HIGH_SCORE_BCD, loc_400e } from "./names.js";

const BCD_TOP = 2;         // a field's most-significant byte; drawBcd walks downward from here
const PRIMARY_FIELD = 0;   // field selector 0 -> primary player field

export function drawScoreFieldByIndex(m, index = m.regs.a) {
  const { mem8 } = m;

  // "Redraw all" form: index >=3 descends, calling itself for index-1, index-2, ... down to 0.
  if (index >= 3) {
    let i = index;
    for (;;) {
      i = u8(i - 1);
      drawScoreFieldByIndex(m, i);
      if (i === 0) return;
    }
  }

  // Index 0: player-1 score into the primary field, sourced from the top byte of PLAYER1_SCORE_BCD.
  if (index === 0) return drawScoreToSelectedPlayerField(m, PRIMARY_FIELD, PLAYER1_SCORE_BCD + BCD_TOP);
  // Index 2: the high score, sourced from the top byte of HIGH_SCORE_BCD.
  if (index === 2) return drawHighScoreDigits(m, HIGH_SCORE_BCD + BCD_TOP);

  // index === 1
  // Player-2 field is only painted while its live flag is set; the flag value also selects the alt field.
  const gate = mem8[loc_400e];
  if (gate === 0) return;
  return drawScoreToSelectedPlayerField(m, gate, PLAYER2_SCORE_BCD + BCD_TOP);
}
