// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimArm10 — frog-animation arm 10 (sibling of arm 0). Loads its row-advance/count/column from
 * the lane-parameter block (the arm-10 triple at ACTIVE_LANE_PARAM_BLOCK + 30), points the destination +
 * pattern pointers, arms the plot cursors, and enters the shared render loop (kept dispatched by
 * address). The seven outgoing register values are handed to the loop as a return-line register bridge.
 * LIVE-OUT: memory-only.
 */
import {
  ACTIVE_LANE_PARAM_BLOCK,
  SCROLL_COPY_COLUMN_STRIDE,
  SCROLL_COPY_SRC_PTR,
  LANE_OBJLIST_815A,
  FROG_ANIM_ARM10_DEST_PTR,
  FROG_ANIM_ARM10_SRC_BASE,
  FROG_ANIM_RENDER_LOOP,
} from "./names.js";

export function renderFrogAnimArm10(m) {
  const { mem8, mem16 } = m;

  const rowAdvance = mem8[ACTIVE_LANE_PARAM_BLOCK + 30];
  const rowCount = mem8[ACTIVE_LANE_PARAM_BLOCK + 31];
  const columnIndex = mem8[ACTIVE_LANE_PARAM_BLOCK + 32];
  const destPtr = mem16[FROG_ANIM_ARM10_DEST_PTR];

  mem8[SCROLL_COPY_COLUMN_STRIDE] = rowAdvance;
  mem16[SCROLL_COPY_SRC_PTR] = FROG_ANIM_ARM10_SRC_BASE;

  return (m.regs.a = rowAdvance), (m.regs.b = rowCount), (m.regs.c = columnIndex), (m.regs.hl = destPtr), (m.regs.de = FROG_ANIM_ARM10_SRC_BASE), (m.regs.ix = LANE_OBJLIST_815A), (m.regs.iy = LANE_OBJLIST_815A), m.call(FROG_ANIM_RENDER_LOOP);
}
