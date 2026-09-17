// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndHoldBlink — the colour-cycle blink driver's "leave-as-is" arm: repaint
 * sprite record #1's colour-memory column, then commit its sprite code unchanged.
 *
 * LIVE-OUT: memory-only — the three colour cells at the DE stride, and sprite record #1's code byte.
 */
import { SPRITE_BUFFER } from "./names.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

const COLOR_COLUMN_TOP = 0x75c4;
const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function paintColorColumnAndHoldBlink(m) {
  const { regs, mem8 } = m;

  regs.hl = COLOR_COLUMN_TOP;
  fillDescendingColumn(m);

  regs.a = mem8[SPRITE1_CODE];
  storeBlinkSpriteCode(m);
}
