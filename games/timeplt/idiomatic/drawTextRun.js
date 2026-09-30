// SPDX-License-Identifier: GPL-3.0-only
/** drawTextRun — paint one caption into the character plane and give every cell of it one colour.
 * Glyphs are taken in order from a run that ends at a fixed terminating code. That code is
 * tested BEFORE anything is written, so an empty run paints nothing and the code itself is
 * never painted. Each glyph goes to the cell the cursor names, the caller's colour goes to the
 * same cell in the other plane, and the cursor then steps one place along the line.
 * Coming back from the colour plane is a SET, not a restore: a cursor that arrives already on
 * the colour side has its glyph overwritten by its own colour and is snapped across.
 * LIVE-OUT: the cells painted, and the cursor left one step past the last glyph, returned so a
 * caller can go on writing after the caption.
 *
 * ROM 0x0BFF-0x0C0E (frozen lift translated/loc_0bff.js). Grounding: [seen] (names.js ROUTINES).
 *
 * ROLE IN THE MACHINE. The game's caption painter. Captions are posted as commands to the command
 * ring and drawn by the foreground loop; the ring's handlers (drawTextRunByIndex and the three
 * pen-colour handlers such as drawCaptionInPenColour) look up a caption record -- destination cell,
 * colour, glyph run -- and end here. The runs decode into the English captions the game shows. Not
 * every record is text: two select second-bank tiles that form a shaded banner strip instead.
 *
 * THE TWO PLANES. Character RAM is a glyph plane at 0xA400-0xA7FF with a colour plane 0x400 below
 * it, cell for cell; clearing address bit 0x400 (ROM `res 2,d`) reaches a glyph cell's colour
 * twin and setting it (`set 2,d`) comes back.
 *
 * Parameters: `run` is the address of the first glyph (the ROM's HL), `cursor` the destination
 * cell (DE) and `colour` the colour byte (C).
 */

import { u16 } from "../../../core/int.js";
import { advanceCharCursor } from "./advanceCharCursor.js";

const END_OF_TEXT = 185;
const CHARACTER_PLANE_BIT = 0x400;

export function drawTextRun(m, run = m.regs.hl, cursor = m.regs.de, colour = m.regs.c) {
  const { mem8 } = m;
  let nextGlyph = run;
  let cell = cursor;
  for (;;) {
    // Test for the terminator 0xB9 before writing anything (ROM `ld a,(hl) / cp 0xb9 / ret z`).
    const glyph = mem8[nextGlyph];
    if (glyph === END_OF_TEXT) break;
    // Glyph into the glyph plane, colour into its twin in the colour plane (ROM `ld (de),a /
    // res 2,d / ld a,c / ld (de),a`), then back across by setting the bit (`set 2,d`).
    mem8[cell] = glyph;
    mem8[cell & ~CHARACTER_PLANE_BIT] = colour;
    cell |= CHARACTER_PLANE_BIT;
    // Next glyph of the run, and the cursor one place along the line (ROM `inc hl / rst 0x20`,
    // advanceCharCursor, 32 addresses back: one character to the right on the rotated screen).
    nextGlyph = u16(nextGlyph + 1);
    cell = advanceCharCursor(m, cell);
  }
  // Hand the cursor back (left in DE, where the ROM's callers read it).
  return (m.regs.de = cell);
}
