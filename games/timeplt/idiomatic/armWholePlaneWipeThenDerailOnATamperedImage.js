// SPDX-License-Identifier: GPL-3.0-only
/** armWholePlaneWipeThenDerailOnATamperedImage — arm a wipe of the whole character plane, then check the image that wipe runs under.
 * The painting belongs to other machinery: this entry only seats that machinery's cursor on the
 * plane's first cell and puts a full screen of lines against the counter beside it. The check that
 * follows folds a fixed run of the program image into one eight-bit total and holds it against the
 * value a genuine image gives. Anything else hands control to a tail that unwinds the interrupt
 * frame ONE WORD OUT OF STEP — the arm's own return word is never spent — so the unwind returns to
 * a value that is not an address: a stack misalignment, not a jump into nothing. The wipe is armed
 * either way, since the check gates nothing above it. LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR } from "./names.js";

const PLANE_FIRST_CELL = 0xa400;
const WHOLE_PLANE = 0x20;

const CHECKED_BLOCK = 0x4ba5;
const CHECKED_BYTES = 0xf0;
const GENUINE_TOTAL = 0x11;
const TAMPER_TRAP = 0x0167;

export function armWholePlaneWipeThenDerailOnATamperedImage(m) {
  const { mem8, mem16 } = m;
  mem16[BLANK_LINE_CURSOR] = PLANE_FIRST_CELL;
  mem8[BLANK_LINES_LEFT] = WHOLE_PLANE;

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(CHECKED_BLOCK + i)]);
  if (total !== GENUINE_TOTAL) return m.call(TAMPER_TRAP);
}
