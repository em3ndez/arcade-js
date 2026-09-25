// SPDX-License-Identifier: GPL-3.0-only
/** paintFiveLabelledNumericReadouts — paint five labelled numeric readouts up the tile plane, handing each one's source
 * record, cursor cell and pen colour to the column painter as explicit arguments. LIVE-OUT: memory-only. */

import { paintLabelledNumericReadoutColumn } from "./paintLabelledNumericReadoutColumn.js";
import { HIGH_SCORE_REC1_BASE, HIGH_SCORE_REC2_BASE, HIGH_SCORE_REC3_BASE, HIGH_SCORE_REC4_BASE, HIGH_SCORE_TABLE_BASE, HIGH_SCORE_REC0_CURSOR, HIGH_SCORE_REC1_CURSOR, HIGH_SCORE_REC2_CURSOR, HIGH_SCORE_REC3_CURSOR, HIGH_SCORE_REC4_CURSOR } from "./names.js";

const READOUTS = [
  { source: HIGH_SCORE_TABLE_BASE, cursor: HIGH_SCORE_REC0_CURSOR, pen: 0x14 },
  { source: HIGH_SCORE_REC1_BASE, cursor: HIGH_SCORE_REC1_CURSOR, pen: 0x16 },
  { source: HIGH_SCORE_REC2_BASE, cursor: HIGH_SCORE_REC2_CURSOR, pen: 0x12 },
  { source: HIGH_SCORE_REC3_BASE, cursor: HIGH_SCORE_REC3_CURSOR, pen: 0x15 },
  { source: HIGH_SCORE_REC4_BASE, cursor: HIGH_SCORE_REC4_CURSOR, pen: 0x13 },
];

export function paintFiveLabelledNumericReadouts(m) {
  // the pen threads to the column as an explicit argument and on through the field, so seating it in
  // the register file is no longer needed; the pen is dead after return (equivalence GENUINE_LIVE_OUTS=[]).
  for (const { source, cursor, pen } of READOUTS) {
    paintLabelledNumericReadoutColumn(m, source, cursor, pen);
  }
}
