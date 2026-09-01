// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SHIELD_SAVE_RESTORE_MODE, SHIELD_VRAM_BASE, DRAW_BLOCK_STRIDE } from "./names.js";
import { captureScreenRect } from "./captureScreenRect.js";
import { orBlitBitmap } from "./orBlitBitmap.js";

// Draw four stacked blocks down the screen: capture each region when the mode flag is set, else OR the source bitmap in.
export function drawOrSaveShields(m, a = m.regs.a, de = m.regs.de) {
  m.mem8[SHIELD_SAVE_RESTORE_MODE] = a;
  const rows = 0x16, cols = 0x02;
  let hl = SHIELD_VRAM_BASE;
  for (let pass = 0; ; pass++) {
    if (m.mem8[SHIELD_SAVE_RESTORE_MODE] !== 0) {
      [de, hl] = captureScreenRect(m, hl, de, rows, cols);
    } else {
      [hl, de] = orBlitBitmap(m, hl, de, rows, cols);
    }
    if (pass === 3) break;
    hl = u16(hl + DRAW_BLOCK_STRIDE);
  }
}
