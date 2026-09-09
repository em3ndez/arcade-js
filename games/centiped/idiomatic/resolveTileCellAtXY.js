// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { TILEMAP_PTR_LO, TILEMAP_PTR_HI, loc_8b, loc_ef } from "./names.js";

/**
 * resolveTileCellAtXY — from a screen X (A) and a row (Y), build the tile-map cell
 * pointer at $32/$33, clamp/wrap it onto the grid, then fetch that cell. Column =
 * A>>3 (rounded by bit 2); the row folds into $8b (as Y*8) and the pointer high
 * bits, with a vertical clamp and a top-row special case. Returns the cell in A
 * (0 = empty, else cell^$ef) with N/Z set from it — the shared "test-and-position"
 * helper; leaves the pointer word $32/$33 and the clamped row in $8b. [code]
 */
export function resolveTileCellAtXY(m, a = m.regs.a, y = m.regs.y) {
  const { mem8, mem16 } = m;
  // Column: A>>3 rounded up by bit 2 (lsr a x3 then adc #$00 adds the last carry = original bit 2).
  const lo = u8((a >> 3) + ((a >> 2) & 1));
  mem8[TILEMAP_PTR_LO] = lo;
  mem8[TILEMAP_PTR_HI] = 0x01; // pointer high byte seed (rol'd below)
  // Fold the row into $8b: $8b += (Y*8) & 0xff.
  const acc = u8(u8(y << 3) + mem8[loc_8b]);
  mem8[loc_8b] = acc;
  // Vertical clamp: (0xf7 - $8b) if it does not borrow, else 0; keep only the 8-px column grid.
  let col = (acc <= 0xf7 ? u8(0xf7 - acc) : 0x00) & 0xf8;
  // Shift col left twice, feeding its top two bits into the pointer high byte (asl a / rol $33 x2).
  let hi = 0x01;
  hi = u8((hi << 1) | ((col >> 7) & 1)); col = u8(col << 1);
  hi = u8((hi << 1) | ((col >> 7) & 1)); col = u8(col << 1);
  mem8[TILEMAP_PTR_HI] = hi;
  let val = col | lo; // ora $32: merge the column low bits back in
  // Top-row wrap: only when the high byte is row 7 and the low byte reaches the last block.
  if (hi === 0x07 && val >= 0xc0) val = (val & 0x1f) | 0xa0;
  mem8[TILEMAP_PTR_LO] = val;
  // Fetch the resolved cell; fold $ef in when non-empty (empty stays 0 -> Z set).
  const ptr = mem16[TILEMAP_PTR_LO];
  let result = mem8[ptr];
  if (result !== 0) result = u8(result ^ mem8[loc_ef]);
  // live-out: A = the fetched cell, with N/Z set from it (callers beq/bne on Z, cmp/and on A).
  return [(m.regs.a = result), (m.regs.fZ = result === 0), (m.regs.fN = (result & 0x80) !== 0)];
}
