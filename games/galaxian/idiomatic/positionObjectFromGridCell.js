// SPDX-License-Identifier: GPL-3.0-only
// Derive an object's sprite position fields from the packed grid-cell of its record, using the hardware
// field convention renderObjectSprite reads (record+3 = X, record+4 = Y). The display axes are rotated
// from the formation grid, so the ROW bits drive the X field (a fixed origin minus three-quarters of the
// row) and the COLUMN bits drive the Y field (a moving anchor plus the column scaled up, offset by the
// sprite hotspot).
import { loc_420e } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const PACKED_CELL = 7; // packed row/column grid cell
const SPRITE_X = 3;    // X field (fed by the formation ROW)
const SPRITE_Y = 4;    // Y field (fed by the formation COLUMN)

const ROW_ORIGIN = 124; // origin the row offset is subtracted from
const COL_HOTSPOT = 7;  // sprite-hotspot offset added to the column position

export function positionObjectFromGridCell(m, obj = m.regs.ix) {
  const { mem8 } = m;

  const row = mem8[obj + PACKED_CELL] & 0x70; // row bits (a multiple of 16)
  mem8[obj + SPRITE_X] = ROW_ORIGIN - ((row >> 1) + (row >> 2)); // origin - 3/4 * row

  const col = mem8[obj + PACKED_CELL] & 0x0f; // column bits
  mem8[obj + SPRITE_Y] = mem8[loc_420e] + (col << 4) + COL_HOTSPOT;
}
