// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitFrogAnimColumnOnTrigger — frog-animation pre-helper. When its trigger cell is set, blit an eight-row tile
 * pair (two bytes per row) from the pattern source down a VRAM column, then clear the trigger
 * so the blit runs once. A clear trigger returns at once, touching nothing.
 * LIVE-OUT: memory-only.
 */
import { FROG_ANIM_BLIT_TRIGGER, FROG_ANIM_COLUMN_VRAM, FROG_ANIM_TILE_PAIR_SRC } from "./names.js";

const ROWS = 8;
const ROW_STRIDE = 32; // dest steps a full column each row (one byte advance + the 31-byte add)
const PAIR_BYTES = 2;

export function blitFrogAnimColumnOnTrigger(m) {
  const { mem, mem8 } = m;
  if (mem8[FROG_ANIM_BLIT_TRIGGER] === 0) return;
  for (let row = 0; row < ROWS; row++) {
    const dest = FROG_ANIM_COLUMN_VRAM + row * ROW_STRIDE;
    const src = FROG_ANIM_TILE_PAIR_SRC + row * PAIR_BYTES;
    mem8[dest] = mem.read8(src);
    mem8[(dest + 1)] = mem.read8(src + 1);
  }
  mem8[FROG_ANIM_BLIT_TRIGGER] = 0;
}
