// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawTileColumnTriple (ROM 0x03af) -- copy three source bytes UP one VRAM tilemap column.
 *
 * WHAT IT IS
 *   A render primitive for the column-repaint facility. It copies three consecutive source bytes into a
 *   destination tilemap column, moving up one tile row (-32 on the destination low byte) between each
 *   write, then advances the destination low byte by +98 (0x62) so the next call lines up the following
 *   column. The high byte of the destination is held fixed, so the whole walk stays inside one VRAM page.
 *
 * ROLE IN THE MACHINE
 *   The per-frame draw walk redrawTileColumnsPeriodically (0x0367) calls this in its draw phase to repaint
 *   a run of tilemap columns from the ROM source TILE_COLUMN_TABLE. Because it returns the advanced source
 *   and destination pointers, callers chain it column after column without recomputing addresses.
 *
 * Grounding: [seen] (names.js cert for 0x03af).
 *
 * LIVE-OUT: m.regs.hl = advanced source pointer (past the three bytes read); m.regs.de = destination with
 *   the fixed high byte and the +98 next-column low byte; m.regs.a = that same next-column low byte.
 */
import { u8, u16 } from "../../../core/int.js";

export function drawTileColumnTriple(m, src = m.regs.hl, dst = m.regs.de) {
  const { mem8 } = m;

  // The destination page (high byte) is constant for the whole column walk; only the low byte moves, and
  // it wraps within the page. Split it out so the -32 row steps and +98 column step stay 8-bit.
  const hi = dst >> 8; // high byte is fixed; the column walk wraps the low byte within the page
  let lo = dst & 0xff;
  let read = src;

  // Three rows of the column, bottom to top: copy one source byte into the current cell, bump the source
  // pointer to the next byte, then step the destination low byte up one tile row (-32) within the page.
  for (let i = 0; i < 3; i++) {
    mem8[(hi << 8) | lo] = mem8[read];
    read = u16(read + 1);
    lo = u8(lo - 32);
  }

  // After three -32 steps the low byte sits three rows up; +98 re-lands it to seed the next column start.
  const nextLo = u8(lo + 98);
  // Publish the advanced pointers so a chained caller resumes at the next source byte and next column.
  return (m.regs.hl = read, m.regs.de = (hi << 8) | nextLo, m.regs.a = nextLo);
}
