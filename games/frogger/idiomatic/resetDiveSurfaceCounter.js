// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetDiveSurfaceCounter — re-arm the dive surface-timer for a new cycle. When the busy latch is
 * clear, bump the figure-animation step gate by one, seed both surface-timer cells from the low
 * nibble of the shared frame buffer (times eight), then raise the busy latch so a later pass does not
 * re-seed. A set busy latch returns at once, touching nothing. LIVE-OUT: memory-only.
 */
import {
  SPRITE_FRAME_BUSY_LATCH1,
  FIGURE_ANIM_STEP_GATE,
  ANIM_FRAME_BUFFER,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
} from "./names.js";

const LOW_NIBBLE = 0x0f;
const SEED_SCALE = 8;

export function resetDiveSurfaceCounter(m) {
  const { mem8 } = m;
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return; // busy latch already set -> armed this cycle
  mem8[FIGURE_ANIM_STEP_GATE] = mem8[FIGURE_ANIM_STEP_GATE] + 1;
  const seed = (mem8[ANIM_FRAME_BUFFER] & LOW_NIBBLE) * SEED_SCALE;
  mem8[TWOPLAYER_FRAME_CELL_8146] = seed;
  mem8[TWOPLAYER_FRAME_CELL_8147] = seed;
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 1;
}
