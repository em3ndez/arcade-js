// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blitTile3x3Block — stamp a 3-wide, 3-tall tile block into video RAM. ROM 0x3307-0x3324. [seen]
 *
 * A leaf blitter for the round-marker glyph. Video RAM is a 32-cell-wide grid, so cells one
 * screen row apart are 0x20 (32) addresses apart. For each of three rows it copies three
 * consecutive source bytes into three consecutive video cells, then steps the destination down
 * one screen row before painting the next row. Both source and destination pointers are handed
 * in by the caller: the source is a nine-byte glyph in ROM (e.g. MARKER_GLYPH_SRC at 0x2754, or
 * GLYPH_TILES_B at 0x2050), the destination the top-left video cell of the target square.
 *
 * The per-row down-step is the three writes (which advance the destination by +3) plus a single
 * +0x1d, totalling 0x20 — exactly one 32-cell screen row down, back at the block's left column.
 * On the machine a RAM cell (0x8f0b) serves as the row counter: it is bumped after each row,
 * compared against 3 to end the loop, and zeroed on completion; that bookkeeping cell is tracked
 * here as a plain loop index and left cleared, matching the routine's exit state.
 *
 * LIVE-OUT: HL = dst + 0x60 (three rows x 0x20) AND DE = src + 9 (three rows x three bytes) —
 * BOTH pointers advance. A chained caller stamps the next block straight from the advanced
 * SOURCE (DE) after this returns, so dropping the source advance renders a wrong glyph; callers
 * that need only the destination reload it. A memory-only test cannot see either, so both are
 * stated.
 */
export function blitTile3x3Block(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  let cell = dst;
  let tile = src;
  // Three glyph rows. On the machine the row count lives in RAM cell 0x8f0b, incremented and
  // compared against 3 each pass, then zeroed at the end; here it is a plain loop counter.
  for (let row = 0; row < 3; row++) {
    // One row: copy three source tiles into three side-by-side video cells, advancing both
    // pointers together across the row.
    for (let col = 0; col < 3; col++) {
      mem8[cell] = mem8[tile];
      cell = u16(cell + 1);
      tile = u16(tile + 1);
    }
    // Step down one screen row: +0x1d after the three +1 writes totals 0x20 (32 cells),
    // realigned to this block's left column.
    cell = u16(cell + 0x1d);
  }

  // Both pointers left advanced past the block: dst + 0x60 and src + 9 (both live-out).
  return [(m.regs.hl = u16(cell)), (m.regs.de = u16(tile))];
}
