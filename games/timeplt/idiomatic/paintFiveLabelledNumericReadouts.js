// SPDX-License-Identifier: GPL-3.0-only
/** paintFiveLabelledNumericReadouts — paint five labelled numeric readouts up the tile plane, seating each one's source
 * record, cursor cell and pen colour before handing it to the column painter. LIVE-OUT: memory-only. */

import { paintLabelledNumericReadoutColumn } from "./paintLabelledNumericReadoutColumn.js";

const READOUTS = [
  { source: 0xab08, cursor: 0xa711, pen: 0x14 },
  { source: 0xab10, cursor: 0xa713, pen: 0x16 },
  { source: 0xab18, cursor: 0xa715, pen: 0x12 },
  { source: 0xab20, cursor: 0xa717, pen: 0x15 },
  { source: 0xab28, cursor: 0xa719, pen: 0x13 },
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
