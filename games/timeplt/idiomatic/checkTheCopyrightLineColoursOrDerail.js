// SPDX-License-Identifier: GPL-3.0-only
/** checkTheCopyrightLineColoursOrDerail — read the colour of thirteen cells along one line and derail if any of them has been
 * changed. It starts at the caption's own first cell and follows it in the same direction the
 * caption is painted, a fixed stride each time; every cell must hold one of exactly two colours —
 * the two the caption's line is painted and flashed in, so on a genuine image the walk always comes
 * out clean. The first cell holding anything else ends the walk on a transfer into a caption record
 * that merely decodes as instructions: it steps the stack pointer by one and pops misaligned words,
 * so the frame unwinds out of step and control is destroyed rather than reported. That arm has no faithful
 * transcription as a routine, so it raises where the transfer would land. Thirteen good cells
 * return with the last colour, the walked-off pointer, a spent count and the stride still standing,
 * and the flags the walk's final step left.
 * LIVE-OUT: memory; the walk's registers on the clean exit. */

import { u16 } from "../../../core/int.js";
import { F_Z, F_H, F_F5, F_C } from "../../../core/cpu/z80.js";
import { COPYRIGHT_LINE_FIRST_COLOUR_CELL } from "./names.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

const CELLS = 13;
const STRIDE_BACK = -0x20;
const EITHER_COLOUR = [0x10, 0x05];

// The flags standing when the thirteenth good cell has been walked off. The last accepted colour
// leaves the compare with zero difference (Z set, sign and overflow clear); the stride add that
// follows carries out of both nibble and word, so half-carry, carry and the high copy of bit 5
// survive with N clear.
const CLEAN_EXIT_FLAGS = F_Z | F_H | F_F5 | F_C;

export function checkTheCopyrightLineColoursOrDerail(m) {
  const { regs, mem8 } = m;
  let cell = COPYRIGHT_LINE_FIRST_COLOUR_CELL;
  let colour;
  for (let owed = CELLS; owed > 0; owed--) {
    colour = mem8[cell];
    if (!EITHER_COLOUR.includes(colour)) {
      throw new NotImplemented(
        `checkTheCopyrightLineColoursOrDerail: cell ${CELLS - owed} of the copyright line holds colour ${colour}, ` +
          "so the image is tampered and the original runs a caption record as code; a genuine image never does",
      );
    }
    cell = u16(cell + STRIDE_BACK);
  }
  return (regs.a = colour, regs.f = CLEAN_EXIT_FLAGS, regs.hl = cell, regs.b = 0, regs.de = u16(STRIDE_BACK));
}
