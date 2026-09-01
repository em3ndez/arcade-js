// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2081, loc_2806, DRAW_BLOCK_STRIDE } from "./names.js";
import { captureScreenRect } from "./captureScreenRect.js";
import { orBlitBitmap } from "./orBlitBitmap.js";

// Draw four stacked blocks down the screen: capture each region when the mode flag is set, else OR the source bitmap in.
export function loc_021e(m, a = m.regs.a, de = m.regs.de) {
  m.mem8[loc_2081] = a;
  const rows = 0x16, cols = 0x02;
  let hl = loc_2806;
  for (let pass = 0; ; pass++) {
    if (m.mem8[loc_2081] !== 0) {
      [de, hl] = captureScreenRect(m, hl, de, rows, cols);
    } else {
      [hl, de] = orBlitBitmap(m, hl, de, rows, cols);
    }
    if (pass === 3) break;
    hl = u16(hl + DRAW_BLOCK_STRIDE);
  }
}
