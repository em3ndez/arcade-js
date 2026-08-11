// SPDX-License-Identifier: GPL-3.0-only
/** paintFiveLabelledNumericReadouts — paint five labelled numeric readouts up the tile plane, seating each one's source
 * record, cursor cell and pen colour before handing it to the column painter. LIVE-OUT: memory-only. */

import { paintLabelledNumericReadoutColumn } from "./paintLabelledNumericReadoutColumn.js";
import { HIGH_SCORE_REC1_BASE, HIGH_SCORE_REC2_BASE, HIGH_SCORE_REC3_BASE, HIGH_SCORE_REC4_BASE, HIGH_SCORE_TABLE_BASE } from "./names.js";

const READOUTS = [
  { source: HIGH_SCORE_TABLE_BASE, cursor: 0xa711, pen: 0x14 },
  { source: HIGH_SCORE_REC1_BASE, cursor: 0xa713, pen: 0x16 },
  { source: HIGH_SCORE_REC2_BASE, cursor: 0xa715, pen: 0x12 },
  { source: HIGH_SCORE_REC3_BASE, cursor: 0xa717, pen: 0x15 },
  { source: HIGH_SCORE_REC4_BASE, cursor: 0xa719, pen: 0x13 },
];

export function paintFiveLabelledNumericReadouts(m) {
  const { regs } = m;
  for (const { source, cursor, pen } of READOUTS) {
    regs.hl = source;
    regs.de = cursor;
    regs.c = pen;
    paintLabelledNumericReadoutColumn(m);
  }
}
