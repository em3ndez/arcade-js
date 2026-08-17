// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm0 — frog-animation arm 0 (sibling of arms 1 and 6). Loads its row-advance/count/
 * column from the lane-parameter block, points the destination + pattern pointers, arms the plot
 * cursors, and enters the shared render loop (kept dispatched by address). The seven outgoing register
 * values are handed to the loop as a return-line register bridge. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  SPRITE_BLOCK2_BASE,
  FROG_ANIM_ARM0_DEST_PTR,
  FROG_ANIM_ARM0_SRC_BASE,
  FROG_ANIM_RENDER_LOOP,
} from "./names.js";

export function renderFrogAnimArm0(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 1];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 2];
  const destPtr = mem16[FROG_ANIM_ARM0_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM0_SRC_BASE;

  return (m.regs.a = rowAdvance), (m.regs.b = rowCount), (m.regs.c = columnIndex), (m.regs.hl = destPtr), (m.regs.de = FROG_ANIM_ARM0_SRC_BASE), (m.regs.ix = SPRITE_BLOCK2_BASE), (m.regs.iy = SPRITE_BLOCK2_BASE), m.call(FROG_ANIM_RENDER_LOOP);
}
