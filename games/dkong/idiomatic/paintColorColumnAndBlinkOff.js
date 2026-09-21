// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndBlinkOff — the rivet-board colour-cycle arm taken when Mario is in the right
 * half: paint a 3-cell DESCENDING colour column (0xEF, 0xEE, 0xED, stepping down by a live-in
 * stride from the driver), then blink the decorative sprite pair OFF. Record 1 goes through the
 * shared store tail, which may still apply its once-per-sweep tile toggle keyed on the colour
 * counter. LIVE-OUT: memory-only — three colour cells and two sprite code bytes. The stride and
 * colour counter are read-only register live-ins, passed straight through to the callees.
 */
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { COLOR_COLUMN_B_TOP } from "./names.js";
import { blinkSpritePairOff } from "./blinkSpritePairOff.js";

// Top of the colour-RAM column this arm repaints; the fill steps down by the live-in stride.
const COLOR_COLUMN_TOP = COLOR_COLUMN_B_TOP;

export function paintColorColumnAndBlinkOff(m) {
  // Descending colour-column fill: start value 0xEF at COLOR_COLUMN_TOP.
  fillDescendingColumn(m, COLOR_COLUMN_TOP, 0xef);
  blinkSpritePairOff(m);
}
