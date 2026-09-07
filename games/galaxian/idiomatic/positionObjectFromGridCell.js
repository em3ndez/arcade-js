// SPDX-License-Identifier: GPL-3.0-only
// positionObjectFromGridCell -- ROM 0x1147, grounding [seen].
// Turns an alien's formation slot into on-screen sprite coordinates. An object's
// slot is stored as a packed grid cell in record byte 7; this unpacks it into
// the position fields the renderer (renderObjectSprite) reads: record+3 = X,
// record+4 = Y. The display axes are rotated ninety degrees from the formation
// grid, so the cell's ROW bits drive the X field and the cell's COLUMN bits
// drive the Y field. Because the column term is added to the moving formation
// anchor loc_420e (0x420e), every alien's Y tracks the anchor -- which is exactly
// what the side-to-side formation sway drives. The object record defaults to IX.
// Live-out: record+3 (X) and record+4 (Y) of the object at `obj`.
import { loc_420e } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const PACKED_CELL = 7; // packed row/column grid cell
const SPRITE_X = 3;    // X field (fed by the formation ROW)
const SPRITE_Y = 4;    // Y field (fed by the formation COLUMN)

// Constants for the axis conversion.
const ROW_ORIGIN = 124; // origin the row offset is subtracted from
const COL_HOTSPOT = 7;  // sprite-hotspot offset added to the column position

export function positionObjectFromGridCell(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Row bits (mask 0x70, a multiple of 16) drive the X field: the fixed origin
  // 124 minus three-quarters of the row value ((row>>1)+(row>>2) == row*3/4).
  const row = mem8[obj + PACKED_CELL] & 0x70; // row bits (a multiple of 16)
  mem8[obj + SPRITE_X] = ROW_ORIGIN - ((row >> 1) + (row >> 2)); // origin - 3/4 * row

  // Column bits (mask 0x0f) drive the Y field: the moving formation anchor
  // loc_420e plus the column scaled up by 16 (col<<4) plus a 7-pixel sprite
  // hotspot. The anchor term is what makes the whole block sway together.
  const col = mem8[obj + PACKED_CELL] & 0x0f; // column bits
  mem8[obj + SPRITE_Y] = mem8[loc_420e] + (col << 4) + COL_HOTSPOT;
}
