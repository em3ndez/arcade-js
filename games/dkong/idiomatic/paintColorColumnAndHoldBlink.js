// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndHoldBlink — the colour-cycle blink driver's "leave-as-is" arm:
 * repaint sprite record #1's colour-memory column, then commit its sprite code unchanged.
 *
 * The state-0 colour-cycle driver runs a per-frame sweep counter and routes to one of a
 * handful of arms by board and counter phase. This is the plain, non-rivet arm (taken when
 * BOARD != 4): it does two things and returns.
 *
 *   1. Repaint a colour-memory column. It points HL at the column top and hands the shared
 *      descending fill a 3-cell run — laying A, A-1, A-2 at the top, one stride down, and two
 *      strides down. Both the fill VALUE (A) and the STRIDE (DE) are live-in from the driver:
 *      A is 0x10 or 0xEF depending on the sweep-counter phase, and DE is the one-tilemap-row
 *      stride 0x20. So this paints a 3-tile vertical colour cell one row apart, cycling
 *      between the two attribute bytes as the sweep counter advances.
 *
 *   2. Hold the sprite's blink state. It reloads sprite record #1's CURRENT code byte and
 *      hands it to the shared blink-store tail. Unlike the sibling arms — one forcing blink
 *      ON (OR 0x80), one forcing it OFF (AND 0x7F) — this arm passes the code through
 *      UNCHANGED, so it never sets or clears the flip/visibility bit; the shared tail may
 *      still apply its once-per-sweep low-2-bit tile toggle, driven by the counter in C.
 *
 * Writes exactly four cells (the three colour cells and record #1's code byte); reads A, DE
 * and C live-in plus that same code byte. The column top and the sweep counter both belong to
 * the driver above, so they arrive as register inputs rather than as named cells here.
 *
 * LIVE-OUT: memory-only — the three colour cells at the DE stride, and sprite record #1's
 * code byte.
 */
import { SPRITE_BUFFER } from "./names.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

// Top of the colour-memory column this arm repaints; the fill steps down by DE (0x20).
const COLOR_COLUMN_TOP = 0x75c4;
// Record #1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function paintColorColumnAndHoldBlink(m) {
  const { regs, mem } = m;

  // 1. Repaint the 3-cell descending colour column. The fill value (A) and stride (DE) are
  //    live-in from the driver above; this only sets the start pointer.
  regs.hl = COLOR_COLUMN_TOP;
  fillDescendingColumn(m);

  // 2. Reload sprite record #1's current code byte and hand it, UNCHANGED, to the shared
  //    blink-store tail — the arm that leaves the flip/visibility bit exactly as it was.
  regs.a = mem.read8(SPRITE1_CODE);
  storeBlinkSpriteCode(m);
}
