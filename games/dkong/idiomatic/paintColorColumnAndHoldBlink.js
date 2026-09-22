// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintColorColumnAndHoldBlink — the colour-cycle blink driver's "leave-as-is" arm: repaint
 * sprite record #1's colour-memory column, then commit its sprite code unchanged.
 *
 * LIVE-OUT: memory-only — the three colour cells at the DE stride, and sprite record #1's code byte.
 */
import {
  BLINK_COLOR_COLUMN_TOP,
  SPRITE_BUFFER,
} from "./names.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function paintColorColumnAndHoldBlink(m, fillCode = m.regs.a) {
  const { mem8 } = m;

  fillDescendingColumn(m, BLINK_COLOR_COLUMN_TOP, fillCode);

  storeBlinkSpriteCode(m, mem8[SPRITE1_CODE]);
}
