// SPDX-License-Identifier: GPL-3.0-only
import { PLAYFIELD_VRAM_BASE } from "./names.js";

// Clear the play-field framebuffer, skipping the six-byte column margin between rows.
export function clearPlayfield(m) {
  let p = PLAYFIELD_VRAM_BASE;
  for (;;) {
    m.mem8[p] = 0;
    p += 1;
    if ((p & 0x1f) >= 0x1c) p += 6;
    if ((p >> 8) >= 0x40) break;
  }
}
