// SPDX-License-Identifier: GPL-3.0-only
/**
 * positionBonusItemSprite — place the on-board bonus-item sprite at its current grid cell.
 *
 * The bonus-item phase of a board walks the on-board prize — the hat / parasol / purse that
 * rides the girders — through a fixed grid of screen cells, tracking the current cell in an
 * item-position index that runs 0..0x1d. Whenever that index is (re)set, this routine redraws
 * the sprite at the new cell: once at spawn, then after every position step.
 *
 * The cell is looked up in a stored position grid — thirty two-byte (X, Y) entries laid out
 * as 10 columns × 3 rows, X stepping 0x10 across a row and Y taking 0x5C / 0x6C / 0x7C down
 * the rows — indexed by 2*C, and stamped into the item's 4-byte hardware sprite record,
 * record #29 in the sprite shadow buffer:
 *
 *     +0  X     = grid[2*C]        (from the table)
 *     +1  code  = 0x72             (the fixed bonus-item glyph)
 *     +2  attr  = 0x0C             (the fixed colour / attribute)
 *     +3  Y     = grid[2*C + 1]    (from the table)
 *
 * The vblank DMA later blits that shadow record to hardware sprite memory. The index is
 * really the full BC pair; both call sites pass B = 0, so 2*C is the effective offset, but
 * the 16-bit add is kept faithful. A STRAIGHT-LINE LEAF: reads only B/C and the stored grid,
 * writes only the four record bytes, calls nothing.
 *
 * LIVE-OUT: memory-only — the four sprite-record bytes. Both call sites overwrite HL
 * immediately after and read none of the clobbered A/C/flags.
 */
import { SPRITE_BUFFER } from "./names.js";

const POSITION_GRID = 0x360f;         // 30 × (X,Y) cells, 10 cols × 3 rows
const RECORD = SPRITE_BUFFER + 0x74;  // hardware sprite record #29 (the bonus item)

export function positionBonusItemSprite(m) {
  const { regs, mem } = m;

  // Double the cell index (low 8 bits) and add it to the grid base to form the entry
  // pointer. BC is the full index — B is always 0 here, but the 16-bit add is preserved.
  const doubledC = (regs.c << 1) & 0xff;
  const index = ((regs.b << 8) | doubledC) & 0xffff;
  const entry = (POSITION_GRID + index) & 0xffff;

  const x = mem.read8(entry);
  const y = mem.read8((entry + 1) & 0xffff);

  mem.write8(RECORD + 0, x);     // +0  X
  mem.write8(RECORD + 1, 0x72);  // +1  tile code (bonus-item glyph)
  mem.write8(RECORD + 2, 0x0c);  // +2  colour / attribute
  mem.write8(RECORD + 3, y);     // +3  Y
}
