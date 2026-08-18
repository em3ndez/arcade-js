// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveSurfaceTimer — the shared dive surface-timer step. Idle (busy latch clear) returns at once.
 * While the two surface-timer cells differ, just step the counter cell. Once they match, consume one
 * tick and advance the dive anim frame: the alternate (arm-0) table on the even step-gate phase, the
 * main table on the odd phase. LIVE-OUT: memory-only.
 */
import { stepDiveFrameCounter } from "./stepDiveFrameCounter.js";
import { selectDiveVariantFrame } from "./selectDiveVariantFrame.js";
import { copyDiveAnimFrame } from "./copyDiveAnimFrame.js";
import {
  SPRITE_FRAME_BUSY_LATCH1,
  TWOPLAYER_FRAME_CELL_8146,
  TWOPLAYER_FRAME_CELL_8147,
  FIGURE_ANIM_STEP_GATE,
  FROG_ANIM_TILE_PAIR_SRC,
} from "./names.js";

export function stepDiveSurfaceTimer(m) {
  const { mem8 } = m;
  if (mem8[SPRITE_FRAME_BUSY_LATCH1] === 0) return; // dive idle

  if (mem8[TWOPLAYER_FRAME_CELL_8146] !== mem8[TWOPLAYER_FRAME_CELL_8147]) {
    return stepDiveFrameCounter(m, TWOPLAYER_FRAME_CELL_8147); // not yet aligned -> step the counter
  }

  mem8[TWOPLAYER_FRAME_CELL_8147] = mem8[TWOPLAYER_FRAME_CELL_8147] - 1; // aligned -> consume a tick
  if ((mem8[FIGURE_ANIM_STEP_GATE] & 1) === 0) {
    return selectDiveVariantFrame(m);
  }
  return copyDiveAnimFrame(m, FROG_ANIM_TILE_PAIR_SRC);
}
