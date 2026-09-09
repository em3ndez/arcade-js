// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { TILEMAP_PTR_LO, TILEMAP_PTR_HI, loc_8b, loc_ef } from "./names.js";

/**
 * resolveTileCellAtXY -- the shared "position the tile pointer and test the cell there" helper.
 *
 * ROM 0x2XXX (playfield tile subsystem). Grounding: [code] -- the arithmetic is read from the routine;
 * the $32/$33 working pointer is [seen], the $8b scratch and $ef fold are behavioural placeholders.
 *
 * ROLE IN THE MACHINE. Every routine that touches an arbitrary grid cell by SCREEN COORDINATE goes
 * through here first. Given a screen X in A and a row in Y, it composes the 16-bit tile-map cell
 * pointer at $32/$33 (TILEMAP_PTR_LO / TILEMAP_PTR_HI), clamps/wraps it so it always lands on a valid
 * on-grid cell, then fetches that cell and returns it -- so callers get both a positioned pointer they
 * can then write through (e.g. via stampEmptyTileCell) and an immediate empty/occupied answer.
 *
 * THE ADDRESS MATH (why each step exists):
 *  - Column: A>>3, because eight screen pixels map to one tile column; the `+ bit2` rounds to the
 *    nearest column (it recovers the carry the three `lsr` shifts dropped, matching the ROM's adc #$00).
 *  - Row: the row Y is folded into $8b as Y*8 (`Y<<3`) and accumulated, because rows are eight tiles
 *    apart in the linear map; $8b carries the clamped row back out for callers.
 *  - Vertical clamp: `0xf7 - $8b` (or 0 if it would borrow), masked to the 8-pixel grid (`& 0xf8`),
 *    keeps the pointer from running off the top/bottom of the playfield.
 *  - The clamped column is shifted left twice, its top two bits rolled into the pointer HIGH byte
 *    (the ROM's asl a / rol $33 pair) so the address spans the multi-page video RAM correctly.
 *  - Top-row wrap: a special case for the very top block so an address that would spill past the last
 *    block folds back onto the top row instead of into the next region.
 *
 * LIVE-OUT: the $32/$33 pointer positioned on the resolved cell, the clamped row left in $8b, and A =
 * the fetched cell (0 = empty; otherwise the cell folded with $ef) with the Z/N flags set from it, which
 * is exactly what callers branch on (beq/bne on empty-vs-occupied, cmp/and on the folded tile value).
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
  // This is how the row's high bits climb into $33 so the pointer can span the several video pages.
  let hi = 0x01;
  hi = u8((hi << 1) | ((col >> 7) & 1)); col = u8(col << 1);
  hi = u8((hi << 1) | ((col >> 7) & 1)); col = u8(col << 1);
  mem8[TILEMAP_PTR_HI] = hi;
  let val = col | lo; // ora $32: merge the column low bits back in
  // Top-row wrap: only when the high byte is row 7 and the low byte reaches the last block.
  if (hi === 0x07 && val >= 0xc0) val = (val & 0x1f) | 0xa0;
  mem8[TILEMAP_PTR_LO] = val;
  // Fetch the resolved cell; fold $ef in when non-empty (empty stays 0 -> Z set). The $ef fold is the
  // subsystem-wide orientation hinge, so callers compare against the SAME folded space they stamp in.
  const ptr = mem16[TILEMAP_PTR_LO];
  let result = mem8[ptr];
  if (result !== 0) result = u8(result ^ mem8[loc_ef]);
  // live-out: A = the fetched cell, with N/Z set from it (callers beq/bne on Z, cmp/and on A).
  return [(m.regs.a = result), (m.regs.fZ = result === 0), (m.regs.fN = (result & 0x80) !== 0)];
}
