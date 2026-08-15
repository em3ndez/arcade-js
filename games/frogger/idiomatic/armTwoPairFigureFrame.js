// SPDX-License-Identifier: GPL-3.0-only
/**
 * armTwoPairFigureFrame — arm the frame-cell block once. When the busy latch is clear, raise the arm flag, seed the
 * two frame cells from the low nibble of the shared source cell (times 8), then set the busy latch so a
 * later pass does not re-seed. LIVE-OUT: memory-only (the sole caller reloads from memory).
 */
import { SPRITE_FRAME_BUSY_LATCH1, FIGURE_ANIM_STEP_GATE, ANIM_FRAME_BUFFER, TWOPLAYER_FRAME_CELL_8146, TWOPLAYER_FRAME_CELL_8147 } from "./names.js";

const LOW_NIBBLE = 0x0f;
const SEED_SCALE = 8;

export function armTwoPairFigureFrame(m) {
  const { mem8 } = m;
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return; // busy latch already set -> seeded this cycle
  mem8[FIGURE_ANIM_STEP_GATE] = 1;
  seedFrameCells(m);
}

// seed the two frame cells from the shared source cell's low nibble, then raise the busy latch.
function seedFrameCells(m) {
  const { mem8 } = m;
  const seed = (mem8[ANIM_FRAME_BUFFER] & LOW_NIBBLE) * SEED_SCALE;
  mem8[TWOPLAYER_FRAME_CELL_8146] = seed;
  mem8[TWOPLAYER_FRAME_CELL_8147] = seed;
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 1;
}
