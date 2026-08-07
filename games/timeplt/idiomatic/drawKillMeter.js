// SPDX-License-Identifier: GPL-3.0-only
/** drawKillMeter — repaint the meter that shows how many kills are still owed.
 *
 * The era selects a ten-byte row: the two glyphs the bar is built from, then eight end glyphs.
 * The low three bits of the count choose which end glyph, and the count divided by four — five
 * bits of that quotient — is how many bar cells are laid. Cells are laid from a fixed end of the
 * line with the two bar glyphs alternating, then the end glyph, then one blanking glyph, so the
 * bar shortens by a whole cell every four kills while the end glyph slides along with it and
 * covers the remainder. Only the glyph plane is written; nothing sets a colour, and nothing is
 * cleared beyond the single cell past the end glyph.
 * LIVE-OUT: memory only. */

import { u16, u8 } from "../../../core/int.js";
import { ERA_INDEX, KILLS_REMAINING } from "./names.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { offsetAddress } from "./offsetAddress.js";

const ROWS = 0x087c;
const ROW_BYTES = 10;
const END_GLYPHS = 8;
const BAR_START_CELL = 0xa79f;
const CELL_STEP = -32;
const KILLS_PER_CELL = 4;
const LONGEST_BAR = 31;
const BLANK_GLYPH = 241;

export function drawKillMeter(m) {
  const { regs, mem8 } = m;
  regs.hl = ROWS;
  regs.a = u8(ROW_BYTES * mem8[ERA_INDEX]);
  const row = offsetAddress(m);
  const barGlyphs = [mem8[row], mem8[u16(row + 1)]];

  const owed = mem8[KILLS_REMAINING];
  regs.hl = u16(row + 2);
  regs.a = owed & (END_GLYPHS - 1);
  const endGlyph = fetchTableByte(m);

  let cursor = BAR_START_CELL;
  const cells = Math.floor(owed / KILLS_PER_CELL) & LONGEST_BAR;
  for (let cell = 0; cell < cells; cell++) {
    mem8[cursor] = barGlyphs[cell % 2];
    cursor = u16(cursor + CELL_STEP);
  }
  mem8[cursor] = endGlyph;
  cursor = u16(cursor + CELL_STEP);
  mem8[cursor] = BLANK_GLYPH;
}
