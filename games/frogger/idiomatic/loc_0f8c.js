// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f8c — frog-animation pre-helper. When its trigger cell is set, blit an eight-row tile
 * pair (two bytes per row) from the pattern source down a VRAM column, then clear the trigger
 * so the blit runs once. A clear trigger returns at once, touching nothing.
 * LIVE-OUT: memory-only.
 */
import { loc_8118, loc_a806, loc_1413 } from "./names.js";

const ROWS = 8;
const ROW_STRIDE = 32; // dest steps a full column each row (one byte advance + the 31-byte add)
const PAIR_BYTES = 2;

export function loc_0f8c(m) {
  const { mem, mem8 } = m;
  if (mem8[loc_8118] === 0) return;
  for (let row = 0; row < ROWS; row++) {
    const dest = (loc_a806 + row * ROW_STRIDE) & 0xffff;
    const src = (loc_1413 + row * PAIR_BYTES) & 0xffff;
    mem8[dest] = mem.read8(src);
    mem8[(dest + 1) & 0xffff] = mem.read8((src + 1) & 0xffff);
  }
  mem8[loc_8118] = 0;
}
