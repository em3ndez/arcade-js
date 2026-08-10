// SPDX-License-Identifier: GPL-3.0-only
/** paintLabelledNumericReadoutColumn — paint one labelled numeric readout as a single column climbing the tile plane: a
 * three-tile pictogram taken from a record table by the source's lead byte, a six-digit field
 * beneath it, and a three-tile suffix, every cell paired with the caller's pen colour in the
 * colour plane. The column is walked upward a cell at a time and the source is read forward past
 * its lead byte, its digit bytes and its suffix bytes. LIVE-OUT: the painted cells, and the
 * cursor and source pointer left at the foot of the suffix. */

import { advanceCharCursor } from "./advanceCharCursor.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { loc_0d73 } from "./loc_0d73.js";
import { u8, u16 } from "../../../core/int.js";

const PICTOGRAM_TABLE = 0x4cb4;
const RECORD_STRIDE = 3;
const COLOUR_PLANE_BIT = 0x04; // bit 2 of D drops the cursor onto the paired colour cell
const PICTOGRAM_TO_FIELD = 0x80;
const FIELD_TO_SUFFIX = 0x60;

/** stamp one tile and pair its cell with the pen colour. */
function stamp(m, tile) {
  const { regs, mem8 } = m;
  mem8[regs.de] = tile;
  regs.d = regs.d & ~COLOUR_PLANE_BIT;
  regs.a = regs.c;
  mem8[regs.de] = regs.a;
  regs.d = regs.d | COLOUR_PLANE_BIT;
}

export function paintLabelledNumericReadoutColumn(m) {
  const { regs, mem8 } = m;
  const source = regs.hl;

  regs.a = u8(mem8[source] * RECORD_STRIDE);
  regs.hl = PICTOGRAM_TABLE;
  stamp(m, fetchTableByte(m));
  regs.hl = u16(regs.hl + 1);
  advanceCharCursor(m);
  stamp(m, mem8[regs.hl]);
  regs.hl = u16(regs.hl + 1);
  advanceCharCursor(m);
  stamp(m, mem8[regs.hl]);

  regs.de = u16(regs.de - PICTOGRAM_TO_FIELD);
  regs.hl = u16(source + 3);
  loc_0d73(m);

  regs.de = u16(regs.de - FIELD_TO_SUFFIX);
  regs.hl = u16(regs.hl + 3);
  stamp(m, mem8[regs.hl]);
  regs.hl = u16(regs.hl + 1);
  advanceCharCursor(m);
  stamp(m, mem8[regs.hl]);
  regs.hl = u16(regs.hl + 1);
  advanceCharCursor(m);
  stamp(m, mem8[regs.hl]);
}
