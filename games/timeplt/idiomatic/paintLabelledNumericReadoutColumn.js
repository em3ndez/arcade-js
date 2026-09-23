// SPDX-License-Identifier: GPL-3.0-only
/** paintLabelledNumericReadoutColumn — paint one labelled numeric readout as a single column climbing the tile plane: a
 * three-tile pictogram taken from a record table by the source's lead byte, a six-digit field
 * beneath it, and a three-tile suffix, every cell paired with the caller's pen colour in the
 * colour plane. The column is walked upward a cell at a time and the source is read forward past
 * its lead byte, its digit bytes and its suffix bytes. LIVE-OUT: memory only — the cursor, source
 * pointer and scratch bytes the body leaves in registers are all re-seated by the sole caller
 * before its next column, so they are dead after return. */

import { advanceCharCursor } from "./advanceCharCursor.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";
import { u8, u16 } from "../../../core/int.js";
import { READOUT_PICTOGRAM_TABLE } from "./names.js";

const RECORD_STRIDE = 3;
const COLOUR_PLANE_CELL = 0x04 << 8; // clearing bit 2 of the cursor's high byte pairs the tile cell with its colour cell
const PICTOGRAM_TO_FIELD = 0x80;
const FIELD_TO_SUFFIX = 0x60;

/** stamp one tile into a tile-plane cell and pair its colour-plane cell with the pen. */
function stamp(m, tile, cell, pen) {
  const { mem8 } = m;
  mem8[cell] = tile;
  mem8[cell & ~COLOUR_PLANE_CELL] = pen;
}

export function paintLabelledNumericReadoutColumn(m, hl = m.regs.hl, cursor = m.regs.de, pen = m.regs.c) {
  const { mem8 } = m;
  const source = hl;

  // pictogram: three consecutive tiles of the record the source's lead byte selects (stride 3)
  const index = u8(mem8[source] * RECORD_STRIDE);
  const record = u16(READOUT_PICTOGRAM_TABLE + index);
  stamp(m, fetchTableByte(m, READOUT_PICTOGRAM_TABLE, index), cursor, pen);
  cursor = advanceCharCursor(m, cursor);
  stamp(m, mem8[u16(record + 1)], cursor, pen);
  cursor = advanceCharCursor(m, cursor);
  stamp(m, mem8[u16(record + 2)], cursor, pen);

  // six-digit field: drop the cursor a pictogram's height and read the digits forward from the source.
  // the printer takes the source pointer as an argument and the cursor from the machine, and hands both back.
  m.regs.de = u16(cursor - PICTOGRAM_TO_FIELD);
  const [fieldPtr, fieldCursor] = paintSixDigitFieldSuppressingLeadingZeros(m, u16(source + 3));
  cursor = u16(fieldCursor - FIELD_TO_SUFFIX);
  const suffix = u16(fieldPtr + 3);

  // suffix: three more tiles, read forward from where the field left the source pointer
  stamp(m, mem8[suffix], cursor, pen);
  cursor = advanceCharCursor(m, cursor);
  stamp(m, mem8[u16(suffix + 1)], cursor, pen);
  cursor = advanceCharCursor(m, cursor);
  stamp(m, mem8[u16(suffix + 2)], cursor, pen);
}
