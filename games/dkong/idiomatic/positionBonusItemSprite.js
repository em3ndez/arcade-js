// SPDX-License-Identifier: GPL-3.0-only
/**
 * positionBonusItemSprite — place the on-board bonus-item sprite at its current
 * grid cell. ROM 0x15fa.
 *
 * The 0x600A phase-21 handler (sub_1486) walks the on-board bonus prize — the
 * hat / parasol / purse that rides the girders — through a fixed grid of screen
 * cells, tracking the current cell in the item-position index (0x6035, 0..0x1D).
 * Whenever that index is (re)set it calls here to redraw the sprite at the new
 * cell (once at spawn, then after every position step).
 *
 * The cell is looked up in the ROM position grid at 0x360F — thirty two-byte
 * (X, Y) entries laid out as 10 columns × 3 rows (X steps 0x10 across a row,
 * Y = 0x5C / 0x6C / 0x7C down the rows) — indexed by 2*C, and stamped into the
 * item's 4-byte hardware sprite record (record #29, at SPRITE_BUFFER + 0x74):
 *
 *     +0  X     = grid[2*C]        (from the table)
 *     +1  code  = 0x72             (the fixed bonus-item glyph)
 *     +2  attr  = 0x0C             (the fixed colour / attribute)
 *     +3  Y     = grid[2*C + 1]    (from the table)
 *
 * The vblank DMA later blits that shadow record to hardware sprite RAM. The index
 * is really BC (the oracle's `add hl,bc` after `sla c`); both call sites pass
 * B = 0, so 2*C is the effective offset, but the full 16-bit add is kept faithful.
 * A STRAIGHT-LINE LEAF: reads only B/C and the ROM grid, writes only the four
 * record bytes, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-15fa.test.js.
 * GATE:     exhaustive — straight-line total function of (B,C); every C at the
 *           caller's B==0 (the whole real domain) plus a B-breadth sweep, diffed
 *           on RAM − STACK_SCRATCH vs the oracle. Unreached in attract (the bonus
 *           item is gameplay-only), so every case is a crafted (B,C) on a real
 *           booted machine — there is no natural dispatch to capture.
 * LIVE-OUT: memory-only — the four sprite-record bytes. Both call sites overwrite
 *           HL immediately after (with 0x6034 / 0x6032) and read none of the
 *           clobbered A/C/flags; the oracle's push/pop of DE/HL is dead caller-ABI.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js; 0x360F kept hex (a ROM position
 *           table, not work RAM).
 */
import { SPRITE_BUFFER } from "./ram.js";

const POSITION_GRID = 0x360f;         // ROM: 30 × (X,Y) cells, 10 cols × 3 rows
const RECORD = SPRITE_BUFFER + 0x74;  // 0x6974 — hardware sprite record #29 (bonus item)

export function positionBonusItemSprite(m) {
  const { regs, mem } = m;

  // `sla c` doubles the cell index (low 8 bits); `ld hl,0x360F` / `add hl,bc`
  // then forms the entry pointer. BC is the full index — B is always 0 here, but
  // the 16-bit add is preserved exactly.
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
