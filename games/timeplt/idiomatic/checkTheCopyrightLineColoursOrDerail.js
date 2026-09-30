// SPDX-License-Identifier: GPL-3.0-only
/** checkTheCopyrightLineColoursOrDerail — read the colour of thirteen cells along one line and derail if any of them has been
 * changed. It starts at the caption's own first cell and follows it in the same direction the
 * caption is painted, a fixed stride each time; every cell must hold one of exactly two colours —
 * the two the caption's line is painted and flashed in, so on a genuine image the walk always comes
 * out clean. The first cell holding anything else ends the walk on a transfer into a caption record
 * that merely decodes as instructions: it steps the stack pointer by one and pops misaligned words,
 * so the frame unwinds out of step and control is destroyed rather than reported. That arm has no faithful
 * transcription as a routine, so it raises where the transfer would land. Thirteen good cells
 * simply return: neither caller's continuing path reads what the walk leaves in its registers -- each
 * reloads the accumulator, pointer, stride and flags before use and neither reads the count -- so
 * all of it dies here. LIVE-OUT: memory only (nothing on the clean exit). */

import { u16 } from "../../../core/int.js";
import { COPYRIGHT_LINE_FIRST_COLOUR_CELL } from "./names.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

const CELLS = 13;
const STRIDE_BACK = -0x20;
const EITHER_COLOUR = [0x10, 0x05];

export function checkTheCopyrightLineColoursOrDerail(m) {
  const { mem8 } = m;
  let cell = COPYRIGHT_LINE_FIRST_COLOUR_CELL;
  for (let owed = CELLS; owed > 0; owed--) {
    const colour = mem8[cell];
    if (!EITHER_COLOUR.includes(colour)) {
      throw new NotImplemented(
        `checkTheCopyrightLineColoursOrDerail: cell ${CELLS - owed} of the copyright line holds colour ${colour}, ` +
          "so the image is tampered and the original runs a caption record as code; a genuine image never does",
      );
    }
    cell = u16(cell + STRIDE_BACK);
  }
}
